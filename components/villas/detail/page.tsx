"use client";

import { ImageOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildVillaDetailContent } from "@/lib/villas/detail";
import type { VillaImage } from "@/lib/villas/types";
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
  id,
  images,
  payload,
  recommendedVillas,
  settings,
}: VillaDetailPageProps) {

  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(

    () => new Set(),

  );

  const [activeGalleryItem, setActiveGalleryItem] = useState<GalleryItem | null>(null);
  const [deferredImages, setDeferredImages] = useState<VillaImage[]>([]);
  const hasRequestedDeferredImagesRef = useRef(images.length > 0);

  const { listing } = payload;

  const content = buildVillaDetailContent(payload.detail);

  const allGalleryItems = useMemo(

    () => buildGalleryItems(payload, [...images, ...deferredImages]),

    [deferredImages, images, payload],

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

  const loadDeferredGalleryImages = useCallback(async (): Promise<VillaImage[]> => {
    if (hasRequestedDeferredImagesRef.current) {
      return deferredImages;
    }

    hasRequestedDeferredImagesRef.current = true;

    try {
      const response = await fetch(`/api/villas/${encodeURIComponent(id)}/images`, {
        method: "GET",
      });

      if (!response.ok) {
        return [];
      }

      const responsePayload = (await response.json()) as { images?: VillaImage[] };
      const nextImages = Array.isArray(responsePayload.images)
        ? responsePayload.images
        : [];

      setDeferredImages(nextImages);
      return nextImages;
    } catch {
      setDeferredImages([]);
      return [];
    }
  }, [deferredImages, id]);

  const handleGalleryImageClick = (item: GalleryItem) => {

    void loadDeferredGalleryImages();

    if (!item.isMock) {

      setActiveGalleryItem(item);

      return;

    }

    setActiveGalleryItem(visibleGalleryItems[0] ?? null);

  };

  const handleOpenDeferredGallery = () => {
    void loadDeferredGalleryImages().then((loadedImages) => {
      const nextGalleryItems = buildGalleryItems(payload, [
        ...images,
        ...loadedImages,
      ]).filter((item) => !failedImageUrls.has(item.url));

      setActiveGalleryItem(nextGalleryItems[0] ?? null);
    });
  };

  useEffect(() => {
    if (hasRequestedDeferredImagesRef.current) {
      return;
    }

    hasRequestedDeferredImagesRef.current = true;
    let isMounted = true;

    fetch(`/api/villas/${encodeURIComponent(id)}/images`, {
      method: "GET",
    })
      .then(async (response) => {
        if (!response.ok) {
          return [];
        }

        const responsePayload = (await response.json()) as { images?: VillaImage[] };
        return Array.isArray(responsePayload.images) ? responsePayload.images : [];
      })
      .then((nextImages) => {
        if (isMounted) {
          setDeferredImages(nextImages);
        }
      })
      .catch(() => {
        if (isMounted) {
          setDeferredImages([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

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

          <div className="grid aspect-[16/7] place-items-center rounded-2xl bg-[var(--site-surface-tint)] p-4 text-center text-[var(--site-muted)]">

            <div className="grid justify-items-center gap-3">

              <ImageOff className="h-10 w-10" />

              <button
                type="button"
                data-open-deferred-gallery="true"
                className="rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-2 text-sm font-black text-[var(--site-text)] transition hover:border-[var(--site-primary)] hover:text-[var(--site-primary)]"
                onClick={handleOpenDeferredGallery}
              >
                ดูรูปบ้านพัก
              </button>

            </div>

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
