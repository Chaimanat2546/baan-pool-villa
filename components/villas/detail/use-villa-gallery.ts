import { useMemo, useState } from "react";
import type { PublicVillaImage } from "@/lib/villas/public-dto";
import type { GalleryCategoryKey } from "@/lib/site-web-styles/gallery-categories";
import { getServerGalleryLoadState } from "./detail-page-helpers";
import {
  buildDisplayGallery,
  buildGalleryCategories,
  buildGalleryItems,
} from "./helpers";
import type { GalleryItem } from "./types";

interface UseVillaGalleryOptions {
  categoryOrder: GalleryCategoryKey[];
  imageSource: "standard" | "system";
  showCover: boolean;
  id: string;
  initialGalleryImages: PublicVillaImage[];
  initialGalleryLoadFailed: boolean;
  initialGalleryPreviewImages: PublicVillaImage[];
}

const EMPTY_FAILED_IMAGE_URLS = new Set<string>();

export function useVillaGallery({
  categoryOrder,
  imageSource,
  showCover,
  id,
  initialGalleryImages,
  initialGalleryLoadFailed,
  initialGalleryPreviewImages,
}: UseVillaGalleryOptions) {
  const galleryLoadState = useMemo(
    () =>
      getServerGalleryLoadState(
        id,
        initialGalleryImages,
        initialGalleryLoadFailed,
      ),
    [id, initialGalleryImages, initialGalleryLoadFailed],
  );
  const [failedImageState, setFailedImageState] = useState<{
    urls: Set<string>;
    villaId: string;
  }>(
    () => ({ urls: new Set(), villaId: id }),
  );
  const [activeGalleryState, setActiveGalleryState] = useState<{
    item: GalleryItem | null;
    villaId: string;
  }>(() => ({ item: null, villaId: id }));
  const failedImageUrls =
    failedImageState.villaId === id
      ? failedImageState.urls
      : EMPTY_FAILED_IMAGE_URLS;
  const activeGalleryItem =
    activeGalleryState.villaId === id ? activeGalleryState.item : null;

  const allGalleryItems = useMemo(
    () => buildGalleryItems(galleryLoadState.images),
    [galleryLoadState.images],
  );
  const visibleGalleryItems = useMemo(
    () => allGalleryItems.filter((item) => !failedImageUrls.has(item.url)),
    [allGalleryItems, failedImageUrls],
  );
  const galleryItems = useMemo(
    () => buildDisplayGallery(visibleGalleryItems),
    [visibleGalleryItems],
  );
  const galleryPreviewItems = useMemo(
    () => {
      const previewSourceImages =
        imageSource === "system"
          ? initialGalleryPreviewImages
          : galleryLoadState.images;
      const previewItems = buildGalleryItems(
        previewSourceImages,
        imageSource === "system",
      ).filter((item) => !failedImageUrls.has(item.url));

      return imageSource === "system"
        ? previewItems.slice(0, 4)
        : buildDisplayGallery(previewItems);
    },
    [
      failedImageUrls,
      galleryLoadState.images,
      imageSource,
      initialGalleryPreviewImages,
    ],
  );
  const galleryCategories = useMemo(
    () =>
      buildGalleryCategories(
        visibleGalleryItems.filter(
          (item) => item.zoneKey !== "uncategorized" && (showCover || !item.isCover),
        ),
        categoryOrder,
      ),
    [categoryOrder, showCover, visibleGalleryItems],
  );

  const handleImageError = (imageUrl: string) => {
    setFailedImageState((currentState) => {
      const currentImageUrls =
        currentState.villaId === id
          ? currentState.urls
          : EMPTY_FAILED_IMAGE_URLS;

      if (currentImageUrls.has(imageUrl)) {
        return currentState;
      }

      const nextImageUrls = new Set(currentImageUrls);
      nextImageUrls.add(imageUrl);
      return { urls: nextImageUrls, villaId: id };
    });
  };

  const setActiveGalleryItem = (item: GalleryItem | null) => {
    setActiveGalleryState({ item, villaId: id });
  };

  const handleGalleryImageClick = (item: GalleryItem) => {
    const matchingItem = visibleGalleryItems.find(
      (galleryItem) => !galleryItem.isMock && galleryItem.key === item.key,
    );
    const firstRealItem = visibleGalleryItems.find(
      (galleryItem) => !galleryItem.isMock,
    );

    setActiveGalleryItem(matchingItem ?? firstRealItem ?? null);
  };

  return {
    activeGalleryItem,
    galleryCategories,
    galleryItems,
    galleryPreviewItems,
    galleryLoadError: galleryLoadState.error,
    galleryLoadStatus: galleryLoadState.status,
    handleGalleryImageClick,
    handleImageError,
    setActiveGalleryItem,
    shouldShowGallerySkeleton: false,
    visibleGalleryItemCount: visibleGalleryItems.length,
  };
}
