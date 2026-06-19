import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicVillaImage } from "@/lib/villas/public-dto";
import {
  getActiveGalleryLoadState,
  getInitialGalleryLoadState,
  getPreviewGalleryLoadState,
  type GalleryLoadState,
  type LoadGalleryImagesOptions,
} from "./detail-page-helpers";
import {
  buildDisplayGallery,
  buildGalleryCategories,
  buildGalleryItems,
} from "./helpers";
import type { GalleryItem } from "./types";

const BACKGROUND_GALLERY_IDLE_TIMEOUT_MS = 3000;
// Browsers without requestIdleCallback need a fixed delay that keeps first paint quiet.
const BACKGROUND_GALLERY_FALLBACK_DELAY_MS = 1200;
const GALLERY_LOAD_ERROR_MESSAGE = "โหลดรูปไม่สำเร็จ ลองใหม่ได้";

interface GalleryImagesResponse {
  images?: PublicVillaImage[];
}

interface UseVillaGalleryOptions {
  id: string;
  initialGalleryImages: PublicVillaImage[];
}

function getStartingGalleryLoadState(
  villaId: string,
  images: PublicVillaImage[],
): GalleryLoadState {
  return images.length > 0
    ? getPreviewGalleryLoadState(villaId, images)
    : getInitialGalleryLoadState(villaId);
}

export function useVillaGallery({
  id,
  initialGalleryImages,
}: UseVillaGalleryOptions) {
  const [galleryLoadState, setGalleryLoadState] = useState<GalleryLoadState>(
    () => getStartingGalleryLoadState(id, initialGalleryImages),
  );
  const galleryLoadStateRef = useRef<GalleryLoadState>(
    getStartingGalleryLoadState(id, initialGalleryImages),
  );
  const inFlightPromiseRef = useRef<{
    id: string;
    promise: Promise<PublicVillaImage[]>;
  } | null>(null);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeGalleryItem, setActiveGalleryItem] =
    useState<GalleryItem | null>(null);

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
        getStartingGalleryLoadState(id, initialGalleryImages),
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
                    error: GALLERY_LOAD_ERROR_MESSAGE,
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
                  error: GALLERY_LOAD_ERROR_MESSAGE,
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

  const activeGalleryLoadState = getActiveGalleryLoadState(galleryLoadState, id);
  const allGalleryItems = useMemo(
    () => buildGalleryItems(activeGalleryLoadState.images),
    [activeGalleryLoadState.images],
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
  const galleryLoadStatus = activeGalleryLoadState.status;

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
        const latestGalleryItems = buildGalleryItems(loadedImages).filter(
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
      .catch(() => {
        if (!item.isMock) {
          setActiveGalleryItem(item);
        }
      });
  };

  const handleGalleryRetry = () => {
    void loadGalleryImages().catch(() => undefined);
  };

  return {
    activeGalleryItem,
    galleryCategories,
    galleryItems,
    galleryLoadError: activeGalleryLoadState.error,
    galleryLoadStatus,
    handleGalleryImageClick,
    handleGalleryRetry,
    handleImageError,
    setActiveGalleryItem,
    shouldShowGallerySkeleton:
      galleryLoadStatus === "loading" ||
      (galleryLoadStatus === "idle" && galleryItems.length === 0),
    visibleGalleryItemCount: visibleGalleryItems.length,
  };
}
