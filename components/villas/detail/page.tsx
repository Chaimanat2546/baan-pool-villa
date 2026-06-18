"use client";

import { buildVillaDetailContent } from "@/lib/villas/detail";
import type { VillaImage } from "@/lib/villas/types";
import { BookingSidebar } from "./booking-sidebar";
import { Breadcrumbs } from "./breadcrumbs";
import { VillaIntro } from "./content-sections";
import { hasEnabledBookingContact } from "./detail-page-helpers";
import {
  VillaDetailGallery,
  VillaDetailGalleryError,
} from "./detail-page-gallery";
import { DetailLayoutRenderer } from "./detail-layout-renderer";
import { GalleryLightbox } from "./gallery";
import type { VillaDetailPageProps } from "./types";
import { useVillaGallery } from "./use-villa-gallery";

const EMPTY_INITIAL_GALLERY_IMAGES: VillaImage[] = [];

export function VillaDetailPage({
  id,
  initialGalleryImages = EMPTY_INITIAL_GALLERY_IMAGES,
  payload,
  recommendedSection,
  settings,
}: VillaDetailPageProps) {
  const { listing } = payload;
  const content = buildVillaDetailContent(payload.detail);
  const showMobileBookingContact = hasEnabledBookingContact(settings.detailLayout);
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
  } = useVillaGallery({ id, initialGalleryImages, payload });

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
        totalImageCount={visibleGalleryItemCount}
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
