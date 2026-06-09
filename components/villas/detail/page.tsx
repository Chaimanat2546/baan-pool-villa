"use client";

import { ImageOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildVillaDetailContent } from "@/lib/villas/detail";
import type { VillaImage } from "@/lib/villas/types";
import { Breadcrumbs } from "./breadcrumbs";
import { VillaIntro } from "./content-sections";
import { DetailLayoutRenderer } from "./detail-layout-renderer";
import { Gallery, GalleryLightbox } from "./gallery";
import { GallerySkeleton } from "./gallery-skeleton";
import {
  buildDisplayGallery,
  buildGalleryCategories,
  buildGalleryItems,
} from "./helpers";
import type { GalleryItem, VillaDetailPageProps } from "./types";

type GalleryLoadStatus = "idle" | "loading" | "loaded" | "error";

interface GalleryImagesResponse {
  images?: VillaImage[];
}

interface GalleryLoadState {
  error: string | null;
  images: VillaImage[];
  status: GalleryLoadStatus;
  villaId: string;
}

function getInitialGalleryLoadState(villaId: string): GalleryLoadState {
  return {
    error: null,
    images: [],
    status: "idle",
    villaId,
  };
}

export function VillaDetailPage({
  id,
  payload,
  recommendedVillas,
  settings,
}: VillaDetailPageProps) {
  const [galleryLoadState, setGalleryLoadState] = useState<GalleryLoadState>(
    () => getInitialGalleryLoadState(id),
  );
  const galleryLoadStateRef = useRef<GalleryLoadState>(
    getInitialGalleryLoadState(id),
  );
  const inFlightPromiseRef = useRef<{
    id: string;
    promise: Promise<VillaImage[]>;
  } | null>(null);
  const activeGalleryLoadState =
    galleryLoadState.villaId === id
      ? galleryLoadState
      : getInitialGalleryLoadState(id);
  const deferredImages = activeGalleryLoadState.images;
  const galleryLoadStatus = activeGalleryLoadState.status;
  const galleryLoadError = activeGalleryLoadState.error;

  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(

    () => new Set(),

  );

  const [activeGalleryItem, setActiveGalleryItem] = useState<GalleryItem | null>(null);

  const { listing } = payload;

  const content = buildVillaDetailContent(payload.detail);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setActiveGalleryItem(null);
    });
  }, [id]);

  const replaceGalleryLoadState = useCallback((nextState: GalleryLoadState) => {
    galleryLoadStateRef.current = nextState;
    setGalleryLoadState(nextState);
  }, []);

  const updateGalleryLoadState = useCallback(
    (updater: (currentState: GalleryLoadState) => GalleryLoadState) => {
      setGalleryLoadState((currentState) => {
        const nextState = updater(currentState);
        galleryLoadStateRef.current = nextState;
        return nextState;
      });
    },
    [],
  );

  const loadGalleryImages = useCallback(async () => {
    const latestGalleryLoadState = galleryLoadStateRef.current;

    if (
      latestGalleryLoadState.villaId === id &&
      latestGalleryLoadState.status === "loaded"
    ) {
      return latestGalleryLoadState.images;
    }

    const inFlightRequest = inFlightPromiseRef.current;
    if (inFlightRequest?.id === id) {
      return inFlightRequest.promise;
    }

    const requestId = id;
    replaceGalleryLoadState({
      error: null,
      images: [],
      status: "loading",
      villaId: requestId,
    });
    setFailedImageUrls(new Set());

    const promise = fetch(`/api/villas/${encodeURIComponent(requestId)}/images`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load villa images");
        }

        const data = (await response.json()) as GalleryImagesResponse;
        return Array.isArray(data.images) ? data.images : [];
      });

    inFlightPromiseRef.current = { id: requestId, promise };

    try {
      const loadedImages = await promise;

      updateGalleryLoadState((currentState) =>
        currentState.villaId === requestId
          ? {
              error: null,
              images: loadedImages,
              status: "loaded",
              villaId: requestId,
            }
          : currentState,
      );

      return loadedImages;
    } catch (error) {
      updateGalleryLoadState((currentState) =>
        currentState.villaId === requestId
          ? {
              ...currentState,
              error: "โหลดรูปไม่สำเร็จ ลองใหม่ได้",
              status: "error",
            }
          : currentState,
      );

      throw error;
    } finally {
      if (inFlightPromiseRef.current?.id === requestId) {
        inFlightPromiseRef.current = null;
      }
    }
  }, [id, replaceGalleryLoadState, updateGalleryLoadState]);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (!cancelled) {
        void loadGalleryImages().catch(() => undefined);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadGalleryImages]);

  const allGalleryItems = useMemo(

    () => buildGalleryItems(payload, deferredImages),

    [deferredImages, payload],

  );

  const visibleGalleryItems = useMemo(

    () => allGalleryItems.filter((item) => !failedImageUrls.has(item.url)),

    [allGalleryItems, failedImageUrls],

  );

  const galleryItems = useMemo(

    () => buildDisplayGallery(visibleGalleryItems),

    [visibleGalleryItems],

  );

  const galleryCategories = useMemo(

    () => buildGalleryCategories(visibleGalleryItems),

    [visibleGalleryItems],

  );

  const handleImageError = (imageUrl: string) => {

    setFailedImageUrls((currentImageUrls) => {

      if (currentImageUrls.has(imageUrl)) {

        return currentImageUrls;

      }

      const nextImageUrls = new Set(currentImageUrls);

      nextImageUrls.add(imageUrl);

      return nextImageUrls;

    });

  };

  const handleGalleryImageClick = (item: GalleryItem) => {
    void loadGalleryImages()
      .then((loadedImages) => {
        const latestGalleryItems = buildGalleryItems(payload, loadedImages).filter(
          (galleryItem) => !failedImageUrls.has(galleryItem.url),
        );
        const matchingItem =
          latestGalleryItems.find((galleryItem) => galleryItem.key === item.key) ??
          item;

        if (!matchingItem.isMock) {

          setActiveGalleryItem(matchingItem);

          return;

        }

        setActiveGalleryItem(latestGalleryItems[0] ?? null);
      })
      .catch(() => undefined);

  };

  const handleGalleryRetry = () => {
    void loadGalleryImages().catch(() => undefined);
  };

  return (

    <main className="min-h-screen overflow-x-hidden bg-[var(--site-surface-soft)] pb-24 text-[var(--site-text)] lg:pb-0">

      <Breadcrumbs listing={listing} />

      {galleryLoadStatus === "loading" ? (

        <GallerySkeleton />

      ) : galleryItems.length > 0 ? (

        <Gallery

          items={galleryItems}

          listing={listing}

          onImageClick={handleGalleryImageClick}

          onImageError={handleImageError}

          totalImageCount={visibleGalleryItems.length}

        />

      ) : (

        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <div className="grid aspect-[16/7] place-items-center rounded-2xl bg-[var(--site-surface-tint)] text-[var(--site-muted)]">

            <ImageOff className="h-10 w-10" />

          </div>

        </section>

      )}

      {galleryLoadStatus === "error" ? (
        <section className="mx-auto mt-3 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-3 text-sm font-bold text-[var(--site-muted)]"
            data-gallery-load-status="error"
          >
            <span>{galleryLoadError}</span>
            <button
              className="rounded-full bg-[var(--site-primary)] px-3 py-1.5 text-xs font-black text-[var(--site-on-primary)]"
              data-gallery-retry="true"
              type="button"
              onClick={handleGalleryRetry}
            >
              ลองใหม่
            </button>
          </div>
        </section>
      ) : null}

      <div className="mx-auto w-full max-w-[402px] px-[22.5px] py-8 sm:max-w-7xl sm:px-6 lg:px-8">

        <VillaIntro content={content} listing={listing} />

      </div>

      <DetailLayoutRenderer

        content={content}

        galleryCategories={galleryCategories}

        layout={settings.detailLayout}

        listing={listing}

        recommendedVillas={recommendedVillas}

        settings={settings}

      />

      <GalleryLightbox

        activeItem={activeGalleryItem}

        categories={galleryCategories}

        listing={listing}

        onClose={() => {
          setActiveGalleryItem(null);
        }}

        onImageError={handleImageError}

        onSelect={setActiveGalleryItem}

      />

    </main>

  );

}
