"use client";

import { ImageOff } from "lucide-react";
import { useMemo, useState } from "react";
import { buildVillaDetailContent } from "@/lib/villas/detail";
import { Breadcrumbs } from "./breadcrumbs";
import { VillaIntro } from "./content-sections";
import { DetailLayoutRenderer } from "./detail-layout-renderer";
import { Gallery, GalleryLightbox } from "./gallery";
import {
  buildDisplayGallery,
  buildGalleryCategories,
  buildGalleryItems,
} from "./helpers";
import type { GalleryItem, VillaDetailPageProps } from "./types";

export function VillaDetailPage({
  images,
  payload,
  recommendedVillas,
  settings,
}: VillaDetailPageProps) {

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

    <main className="min-h-screen overflow-x-hidden bg-[var(--site-surface-soft)] pb-24 text-[var(--site-text)] lg:pb-0">

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

          <div className="grid aspect-[16/7] place-items-center rounded-2xl bg-[var(--site-surface-tint)] text-[var(--site-muted)]">

            <ImageOff className="h-10 w-10" />

          </div>

        </section>

      )}

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
