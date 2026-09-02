"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import type { PublicAdvertisement } from "@/lib/advertisements/types";
import { pushVillaDetailView } from "@/lib/marketing-data-layer";
import type { SiteSettings } from "@/lib/site-settings/types";
import type { SiteContactSettings } from "@/lib/site-contact-settings/types";
import type {
  GalleryStyleSettings,
  SiteVillaCardStyle,
} from "@/lib/site-web-styles/types";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { BookingCalendarMonth } from "@/lib/villas/booking-calendar";
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
import { useVillaGallery } from "./use-villa-gallery";

const GalleryLightbox = dynamic(
  () => import("./gallery-lightbox").then((module) => module.GalleryLightbox),
);
const GalleryOverviewModal = dynamic(
  () =>
    import("./gallery-overview-modal").then(
      (module) => module.GalleryOverviewModal,
    ),
);

type GalleryModalView = "closed" | "overview" | "lightbox";
interface GalleryModalState {
  returnToOverview: boolean;
  villaId: string;
  view: GalleryModalView;
}

interface VillaDetailClientShellProps {
  advertisements: PublicAdvertisement[];
  bookingCalendars: Record<string, BookingCalendarMonth>;
  bookingSidebarId: string;
  children: ReactNode;
  contactSettings: SiteContactSettings;
  content: VillaDetailContent;
  currentBookingMonthKey: string;
  galleryStyle: GalleryStyleSettings;
  id: string;
  initialGalleryImages?: PublicVillaImage[];
  initialGalleryLoadFailed?: boolean;
  initialGalleryPreviewImages?: PublicVillaImage[];
  listing: PublicVillaListing;
  recommendedSection: PublicRecommendedVillaSection | null;
  settings: SiteSettings;
  villaCardStyle?: SiteVillaCardStyle;
}

export function VillaDetailClientShell({
  advertisements,
  bookingCalendars,
  bookingSidebarId,
  children,
  contactSettings,
  content,
  currentBookingMonthKey,
  galleryStyle,
  id,
  initialGalleryImages = [],
  initialGalleryLoadFailed = false,
  initialGalleryPreviewImages = initialGalleryImages,
  listing,
  recommendedSection,
  settings,
  villaCardStyle,
}: VillaDetailClientShellProps) {
  const pushedViewItemIdRef = useRef<string | null>(null);
  const [galleryModalState, setGalleryModalState] = useState<GalleryModalState>(
    { returnToOverview: false, villaId: id, view: "closed" },
  );
  const {
    activeGalleryItem,
    galleryCategories,
    galleryItems,
    galleryPreviewItems,
    galleryLoadError,
    galleryLoadStatus,
    handleGalleryImageClick,
    handleImageError,
    setActiveGalleryItem,
    shouldShowGallerySkeleton,
    visibleGalleryItemCount,
  } = useVillaGallery({
    categoryOrder: galleryStyle.categoryOrder ?? [],
    imageSource: galleryStyle.imageSource ?? "standard",
    showCover: galleryStyle.showCover ?? true,
    id,
    initialGalleryImages,
    initialGalleryLoadFailed,
    initialGalleryPreviewImages,
  });

  const galleryModalView =
    galleryModalState.villaId === id ? galleryModalState.view : "closed";
  const isCategorizedGallery = galleryStyle.variant === "categorized-grid";
  const galleryRetryHref = `/villas/${encodeURIComponent(id)}`;

  const handleDirectImageClick = (item: (typeof galleryItems)[number]) => {
    if (isCategorizedGallery) {
      setGalleryModalState({
        returnToOverview: false,
        villaId: id,
        view: "overview",
      });
      return;
    }

    setGalleryModalState({
      returnToOverview: false,
      villaId: id,
      view: "lightbox",
    });
    handleGalleryImageClick(item);
  };

  const handleViewAll = () => {
    if (isCategorizedGallery) {
      setGalleryModalState({
        returnToOverview: false,
        villaId: id,
        view: "overview",
      });
      return;
    }

    const item = galleryItems[3] ?? galleryItems[0];
    if (item) {
      handleDirectImageClick(item);
    }
  };

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
        items={galleryPreviewItems}
        listing={listing}
        onImageClick={handleDirectImageClick}
        onImageError={handleImageError}
        onViewAll={handleViewAll}
        retryHref={galleryRetryHref}
        showSkeleton={shouldShowGallerySkeleton}
        totalImageCount={
          galleryLoadStatus === "loaded" ? visibleGalleryItemCount : null
        }
      />

      <VillaDetailGalleryError
        error={galleryLoadStatus === "error" ? galleryLoadError : null}
        retryHref={galleryRetryHref}
      />

      {children}

      <DetailLayoutRenderer
        advertisements={advertisements}
        bookingCalendars={bookingCalendars}
        bookingSidebarId={bookingSidebarId}
        contactSettings={contactSettings}
        content={content}
        currentBookingMonthKey={currentBookingMonthKey}
        galleryCategories={galleryCategories}
        galleryStyle={galleryStyle}
        layout={settings.detailLayout}
        listing={listing}
        recommendedSection={recommendedSection}
        settings={settings}
        villaCardStyle={villaCardStyle}
      />

      {galleryModalView === "overview" ? (
        <GalleryOverviewModal
          categories={galleryCategories}
          listing={listing}
          onClose={() => {
            setGalleryModalState({
              returnToOverview: false,
              villaId: id,
              view: "closed",
            });
          }}
          onImageError={handleImageError}
          onSelect={(item) => {
            setActiveGalleryItem(item);
            setGalleryModalState({
              returnToOverview: true,
              villaId: id,
              view: "lightbox",
            });
          }}
          style={galleryStyle}
        />
      ) : null}

      {galleryModalView === "lightbox" ? (
        <GalleryLightbox
          activeItem={activeGalleryItem}
          categories={galleryCategories}
          listing={listing}
          onClose={() => {
            setActiveGalleryItem(null);
            setGalleryModalState({
              returnToOverview: false,
              villaId: id,
              view: galleryModalState.returnToOverview ? "overview" : "closed",
            });
          }}
          onImageError={handleImageError}
          onSelect={setActiveGalleryItem}
          showCategorySelector={!isCategorizedGallery}
          style={galleryStyle}
          thumbnailPlacement={
            isCategorizedGallery ? "bottom" : "side"
          }
        />
      ) : null}
    </>
  );
}
