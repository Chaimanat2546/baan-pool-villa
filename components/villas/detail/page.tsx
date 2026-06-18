"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildVillaDetailContent } from "@/lib/villas/detail";
import type { VillaImage } from "@/lib/villas/types";
import { BookingSidebar } from "./booking-sidebar";
import { Breadcrumbs } from "./breadcrumbs";
import { VillaIntro } from "./content-sections";
import {
  getActiveGalleryLoadState,
  getInitialGalleryLoadState,
  getPreviewGalleryLoadState,
  hasEnabledBookingContact,
  type GalleryLoadState,
  type LoadGalleryImagesOptions,
} from "./detail-page-helpers";
import {
  VillaDetailGallery,
  VillaDetailGalleryError,
} from "./detail-page-gallery";
import { DetailLayoutRenderer } from "./detail-layout-renderer";
import { GalleryLightbox } from "./gallery";
import {
  buildDisplayGallery,
  buildGalleryCategories,
  buildGalleryItems,
} from "./helpers";
import type { GalleryItem, VillaDetailPageProps } from "./types";

const BACKGROUND_GALLERY_IDLE_TIMEOUT_MS = 3000;
// Browsers without requestIdleCallback need a fixed delay that keeps first paint quiet.
const BACKGROUND_GALLERY_FALLBACK_DELAY_MS = 1200;
const EMPTY_INITIAL_GALLERY_IMAGES: VillaImage[] = [];

interface GalleryImagesResponse {
  images?: VillaImage[];
}

export function VillaDetailPage({
  id,
  initialGalleryImages = EMPTY_INITIAL_GALLERY_IMAGES,
  payload,
  recommendedSection,
  settings,
}: VillaDetailPageProps) {
  const [galleryLoadState, setGalleryLoadState] = useState<GalleryLoadState>(
    () =>
      initialGalleryImages.length > 0
        ? getPreviewGalleryLoadState(id, initialGalleryImages)
        : getInitialGalleryLoadState(id),
  );
  const galleryLoadStateRef = useRef<GalleryLoadState>(
    initialGalleryImages.length > 0
      ? getPreviewGalleryLoadState(id, initialGalleryImages)
      : getInitialGalleryLoadState(id),
  );
  const inFlightPromiseRef = useRef<{
    id: string;
    promise: Promise<VillaImage[]>;
  } | null>(null);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeGalleryItem, setActiveGalleryItem] =
    useState<GalleryItem | null>(null);

  const { listing } = payload;
  const content = buildVillaDetailContent(payload.detail);
  const activeGalleryLoadState = getActiveGalleryLoadState(galleryLoadState, id);
  const galleryLoadStatus = activeGalleryLoadState.status;
  const galleryLoadError = activeGalleryLoadState.error;
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
      replaceGalleryLoadState(
        initialGalleryImages.length > 0
          ? getPreviewGalleryLoadState(id, initialGalleryImages)
          : getInitialGalleryLoadState(id),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [id, initialGalleryImages, replaceGalleryLoadState]);

  const loadGalleryImages = useCallback(
    async ({ mode = "interactive" }: LoadGalleryImagesOptions = {}) => {
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
        try {
          return await inFlightRequest.promise;
        } catch (error) {
          if (!isBackgroundLoad) {
            updateGalleryLoadState((currentState) =>
              currentState.villaId === id
                ? {
                    ...currentState,
                    error: "โหลดรูปไม่สำเร็จ ลองใหม่ได้",
                    status: "error",
                  }
                : currentState,
            );
          }

          throw error;
        }
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
    },
    [id, replaceGalleryLoadState, updateGalleryLoadState],
  );

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
    () => buildGalleryItems(payload, activeGalleryLoadState.images),
    [activeGalleryLoadState.images, payload],
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

      <VillaDetailGallery
        items={galleryItems}
        listing={listing}
        onImageClick={handleGalleryImageClick}
        onImageError={handleImageError}
        onRetry={handleGalleryRetry}
        showSkeleton={shouldShowGallerySkeleton}
        totalImageCount={visibleGalleryItems.length}
      />

      <VillaDetailGalleryError
        error={galleryLoadStatus === "error" ? galleryLoadError : null}
        onRetry={handleGalleryRetry}
      />

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
        bookingSidebarId={showMobileBookingContact ? "desktop-contact" : "contact"}
        content={content}
        galleryCategories={galleryCategories}
        layout={settings.detailLayout}
        listing={listing}
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
