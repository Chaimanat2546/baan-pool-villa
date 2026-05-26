"use client";

import { ImageOff } from "lucide-react";
import { useMemo, useState } from "react";
import { buildVillaDetailContent } from "@/lib/villas/detail";
import { BookingSidebar } from "./booking-sidebar";
import { Breadcrumbs } from "./breadcrumbs";
import {
  AboutSection,
  AmenitiesSection,
  PolicySection,
  VideoReviewSection,
  VillaIntro,
} from "./content-sections";
import { Gallery, GalleryLightbox } from "./gallery";
import {
  buildDisplayGallery,
  buildGalleryCategories,
  buildGalleryItems,
} from "./helpers";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { NearbySection } from "./nearby-section";
import { RecommendedVillas } from "./recommended-villas";
import type { GalleryItem, VillaDetailPageProps } from "./types";

export function VillaDetailPage({ images, payload }: VillaDetailPageProps) {
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeGalleryItem, setActiveGalleryItem] = useState<GalleryItem | null>(null);
  const { listing } = payload;
  const content = buildVillaDetailContent(payload.detail);
  const allGalleryItems = useMemo(
    () => buildGalleryItems(payload, images),
    [images, payload],
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
    if (!item.isMock) {
      setActiveGalleryItem(item);
      return;
    }
    setActiveGalleryItem(visibleGalleryItems[0] ?? null);
  };
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fbfdfb] pb-24 text-[#063f35] lg:pb-0">
      <Breadcrumbs listing={listing} />
      {galleryItems.length > 0 ? (
        <Gallery
          items={galleryItems}
          listing={listing}
          onImageClick={handleGalleryImageClick}
          onImageError={handleImageError}
          totalImageCount={visibleGalleryItems.length}
        />
      ) : (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid aspect-[16/7] place-items-center rounded-2xl bg-[#e6efeb] text-[#55746b]">
            <ImageOff className="h-10 w-10" />
          </div>
        </section>
      )}
      <div className="mx-auto grid w-full max-w-[402px] gap-8 overflow-hidden px-[22.5px] py-8 sm:max-w-7xl sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
        <div className="min-w-0">
          <VillaIntro content={content} listing={listing} />
          <AboutSection content={content} listing={listing} />
          <VideoReviewSection videos={content.videos} />
          <AmenitiesSection listing={listing} />
          <PolicySection content={content} listing={listing} />
        </div>
        <div className="min-w-0 space-y-8">
          <BookingSidebar content={content} listing={listing} />
          <NearbySection content={content} />
        </div>
      </div>
      <RecommendedVillas listing={listing} />
      <MobileBottomNav listing={listing} />
      <GalleryLightbox
        activeItem={activeGalleryItem}
        categories={galleryCategories}
        listing={listing}
        onClose={() => setActiveGalleryItem(null)}
        onImageError={handleImageError}
        onSelect={setActiveGalleryItem}
      />
    </main>
  );
}
