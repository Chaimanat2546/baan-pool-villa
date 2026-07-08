"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import type { PublicAdvertisement } from "@/lib/advertisements/types";
import { pushVillaDetailView } from "@/lib/marketing-data-layer";
import type { SiteSettings } from "@/lib/site-settings/types";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type {
  PublicRecommendedVillaSection,
  PublicVillaImage,
  PublicVillaListing,
} from "@/lib/villas/public-dto";

import {
  VillaDetailGallery,
  VillaDetailGalleryError,
} from "./detail-page-gallery";
import { DetailLayoutRenderer } from "./detail-layout-renderer";
import { GalleryLightbox } from "./gallery";
import { useVillaGallery } from "./use-villa-gallery";

interface VillaDetailClientShellProps {
  advertisements: PublicAdvertisement[];
  bookingSidebarId: string;
  children: ReactNode;
  content: VillaDetailContent;
  id: string;
  initialGalleryImages?: PublicVillaImage[];
  listing: PublicVillaListing;
  recommendedSection: PublicRecommendedVillaSection | null;
  settings: SiteSettings;
}

export function VillaDetailClientShell({
  advertisements,
  bookingSidebarId,
  children,
  content,
  id,
  initialGalleryImages = [],
  listing,
  recommendedSection,
  settings,
}: VillaDetailClientShellProps) {
  const pushedViewItemIdRef = useRef<string | null>(null);
  const {
    activeGalleryItem,
    galleryCategories,
    galleryItems,
    galleryLoadError,
    galleryLoadStatus,
    handleGalleryImageClick,
    handleGalleryRetry,
    handleImageError,
    setActiveGalleryItem,
    shouldShowGallerySkeleton,
    visibleGalleryItemCount,
  } = useVillaGallery({ id, initialGalleryImages });

  useEffect(() => {
    if (pushedViewItemIdRef.current === listing.id) {
      return;
    }

    pushedViewItemIdRef.current = listing.id;
    pushVillaDetailView(listing);
  }, [listing]);

  return (
    <>
      <VillaDetailGallery
        items={galleryItems}
        listing={listing}
        onImageClick={handleGalleryImageClick}
        onImageError={handleImageError}
        onRetry={handleGalleryRetry}
        showSkeleton={shouldShowGallerySkeleton}
        totalImageCount={visibleGalleryItemCount}
      />

      <VillaDetailGalleryError
        error={galleryLoadStatus === "error" ? galleryLoadError : null}
        onRetry={handleGalleryRetry}
      />

      {children}

      <DetailLayoutRenderer
        advertisements={advertisements}
        bookingSidebarId={bookingSidebarId}
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
    </>
  );
}
