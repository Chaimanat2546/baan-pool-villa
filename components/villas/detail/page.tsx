"use client";

import { ImageOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AnyDetailLayoutConfig,
  DetailLayoutBlock,
} from "@/lib/detail-layout/types";
import { buildVillaDetailContent } from "@/lib/villas/detail";
import type { VillaImage } from "@/lib/villas/types";
import { BookingSidebar } from "./booking-sidebar";
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
type GalleryLoadMode = "background" | "interactive";

const BACKGROUND_GALLERY_IDLE_TIMEOUT_MS = 3000;
// Browsers without requestIdleCallback need a fixed delay that keeps first paint quiet.
const BACKGROUND_GALLERY_FALLBACK_DELAY_MS = 1200;

interface GalleryImagesResponse {
  images?: VillaImage[];
}

interface GalleryLoadState {
  error: string | null;
  images: VillaImage[];
  status: GalleryLoadStatus;
  villaId: string;
}

interface LoadGalleryImagesOptions {
  mode?: GalleryLoadMode;
}

function getInitialGalleryLoadState(villaId: string): GalleryLoadState {
  return {
    error: null,
    images: [],
    status: "idle",
    villaId,
  };
}

function hasEnabledBookingContactBlock(block: DetailLayoutBlock): boolean {
  return block.enabled && block.type === "booking_contact";
}

function hasEnabledBookingContact(layout: AnyDetailLayoutConfig): boolean {
  if (layout.version === 2) {
    return (
      layout.mainSplit.wideRows.some((row) =>
        row.enabled && row.blocks.some(hasEnabledBookingContactBlock),
      ) ||
      layout.mainSplit.narrowRows.some(
        (row) => row.enabled && hasEnabledBookingContactBlock(row.block),
      ) ||
      layout.lockedBottom.some(hasEnabledBookingContactBlock)
    );
  }

  return layout.rows.some(
    (row) => row.enabled && row.blocks.some(hasEnabledBookingContactBlock),
  );
}

export function VillaDetailPage({
  id,
  payload,
  recommendedSection,
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
  const showMobileBookingContact = hasEnabledBookingContact(settings.detailLayout);

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

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) {
        return;
      }

      setActiveGalleryItem(null);
      setFailedImageUrls(new Set());
      replaceGalleryLoadState(getInitialGalleryLoadState(id));
    });

    return () => {
      cancelled = true;
    };
  }, [id, replaceGalleryLoadState]);

  const loadGalleryImages = useCallback(async ({
    mode = "interactive",
  }: LoadGalleryImagesOptions = {}) => {
    const latestGalleryLoadState = galleryLoadStateRef.current;
    const isBackgroundLoad = mode === "background";
    const shouldExposeBackgroundLoad =
      isBackgroundLoad &&
      latestGalleryLoadState.villaId === id &&
      latestGalleryLoadState.images.length === 0;

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
    if (!isBackgroundLoad || shouldExposeBackgroundLoad) {
      replaceGalleryLoadState({
        error: null,
        images: [],
        status: "loading",
        villaId: requestId,
      });
      setFailedImageUrls(new Set());
    }

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
      if (!isBackgroundLoad || shouldExposeBackgroundLoad) {
        updateGalleryLoadState((currentState) =>
        currentState.villaId === requestId
          ? {
              ...currentState,
              error: "โหลดรูปไม่สำเร็จ ลองใหม่ได้",
              status: "error",
            }
          : currentState,
        );
      }

      throw error;
    } finally {
      if (inFlightPromiseRef.current?.id === requestId) {
        inFlightPromiseRef.current = null;
      }
    }
  }, [id, replaceGalleryLoadState, updateGalleryLoadState]);

  useEffect(() => {
    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof window.setTimeout> | null = null;

    const loadWhenIdle = () => {
      if (!cancelled) {
        void loadGalleryImages({ mode: "background" }).catch(() => undefined);
      }
    };

    if ("requestIdleCallback" in window) {
      idleHandle = window.requestIdleCallback(loadWhenIdle, {
        timeout: BACKGROUND_GALLERY_IDLE_TIMEOUT_MS,
      });
    } else {
      timeoutHandle = globalThis.setTimeout(
        loadWhenIdle,
        BACKGROUND_GALLERY_FALLBACK_DELAY_MS,
      );
    }

    return () => {
      cancelled = true;

      if (idleHandle !== null) {
        window.cancelIdleCallback(idleHandle);
      }

      if (timeoutHandle !== null) {
        globalThis.clearTimeout(timeoutHandle);
      }
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
  const shouldShowGallerySkeleton =
    galleryLoadStatus === "loading" ||
    (galleryLoadStatus === "idle" && galleryItems.length === 0);

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

    <main className="min-h-screen overflow-x-hidden bg-[var(--site-surface-soft)] pb-24 text-[var(--site-text)] md:pb-0">

      <Breadcrumbs listing={listing} />

      {shouldShowGallerySkeleton ? (

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

            <div className="flex flex-col items-center gap-3">

              <ImageOff className="h-10 w-10" />

              <button
                className="rounded-full bg-[var(--site-primary)] px-4 py-2 text-sm font-black text-[var(--site-on-primary)]"
                data-gallery-retry="true"
                type="button"
                onClick={handleGalleryRetry}
              >
                โหลดรูปอีกครั้ง
              </button>

            </div>

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

        {showMobileBookingContact ? (
          <div className="mt-4 lg:hidden" data-mobile-booking-contact="true">
            <BookingSidebar
              content={content}
              id="contact"
              listing={listing}
              settings={settings}
            />
          </div>
        ) : null}

      </div>

      <DetailLayoutRenderer

        content={content}

        galleryCategories={galleryCategories}

        layout={settings.detailLayout}

        listing={listing}

        bookingSidebarId={
          showMobileBookingContact ? "desktop-contact" : "contact"
        }

        recommendedSection={recommendedSection}

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
