"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ImageWithSkeleton as Image } from "@/components/ui/image-with-skeleton";
import { useImageActivation } from "@/components/ui/near-viewport-activation";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import type { PublicVillaImage } from "@/lib/villas/public-dto";

const MAX_GALLERY_CARD_IMAGES = 10;
const MIN_GALLERY_CARD_IMAGES = 3;

interface VillaCardGalleryImagesProps {
  alt: string;
  coverImageSrc: string | null;
  href?: string;
  imageLoading?: "eager" | "lazy";
  initialImageUrls?: string[];
  preload?: boolean;
  coverImageActive?: boolean;
  previewActive?: boolean;
  staticImageUrls?: string[];
  villaId: string;
}

interface VillaImagesResponse {
  images?: PublicVillaImage[];
}

function isUsableImageUrl(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function selectVillaCardGalleryImages(
  coverImageSrc: string | null,
  galleryImages: Pick<PublicVillaImage, "imageUrl">[],
): string[] {
  const selectedImages: string[] = [];
  const seenImages = new Set<string>();

  function addImage(imageUrl: string | null | undefined) {
    const trimmedUrl = imageUrl?.trim() ?? "";

    if (!trimmedUrl || seenImages.has(trimmedUrl)) {
      return;
    }

    seenImages.add(trimmedUrl);
    selectedImages.push(trimmedUrl);
  }

  addImage(coverImageSrc);

  for (const image of galleryImages) {
    addImage(image.imageUrl);

    if (selectedImages.length === MAX_GALLERY_CARD_IMAGES) {
      break;
    }
  }

  return selectedImages.length >= MIN_GALLERY_CARD_IMAGES ? selectedImages : [];
}

export function VillaCardGalleryImages({
  alt,
  coverImageSrc,
  href,
  imageLoading,
  initialImageUrls,
  preload = false,
  coverImageActive = true,
  previewActive = true,
  staticImageUrls,
  villaId,
}: VillaCardGalleryImagesProps) {
  const sectionImagesActive = useImageActivation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const thumbsRef = useRef<HTMLDivElement | null>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const staticImages = useMemo(() => {
    if (!staticImageUrls) {
      return null;
    }

    return selectVillaCardGalleryImages(
      coverImageSrc,
      staticImageUrls.map((imageUrl) => ({ imageUrl })),
    );
  }, [coverImageSrc, staticImageUrls]);
  const initialImages = useMemo(
    () =>
      initialImageUrls
        ? selectVillaCardGalleryImages(
            coverImageSrc,
            initialImageUrls.map((imageUrl) => ({ imageUrl })),
          )
        : null,
    [coverImageSrc, initialImageUrls],
  );
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "empty">(
    staticImages
      ? staticImages.length >= MIN_GALLERY_CARD_IMAGES
        ? "ready"
        : "empty"
      : initialImages && initialImages.length >= MIN_GALLERY_CARD_IMAGES
        ? "ready"
        : "loading",
  );
  const [images, setImages] = useState<string[]>(
    staticImages ?? initialImages ?? (coverImageSrc ? [coverImageSrc] : []),
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!sectionImagesActive || staticImages !== null) {
      return;
    }

    const root = rootRef.current;

    if (!root) {
      setStatus("empty");
      setImages([]);
      return;
    }

    let cancelled = false;
    let controller: AbortController | null = null;

    async function loadImages() {
      controller = new AbortController();
      if (initialImages === null) {
        setStatus("loading");
      }

      try {
        const params = new URLSearchParams({
          view: "card",
        });
        const response = await fetch(
          `/api/villas/${encodeURIComponent(villaId)}/images?${params}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("Unable to load villa images");
        }

        const payload = (await response.json()) as VillaImagesResponse;
        const galleryImages = Array.isArray(payload.images)
          ? payload.images.filter((image) => isUsableImageUrl(image.imageUrl))
          : [];
        const nextImages = selectVillaCardGalleryImages(
          coverImageSrc,
          galleryImages,
        );

        if (cancelled) {
          return;
        }

        setImages(nextImages);
        setSelectedIndex(0);
        setStatus(nextImages.length >= MIN_GALLERY_CARD_IMAGES ? "ready" : "empty");
      } catch {
        if (!cancelled) {
          setImages([]);
          setStatus("empty");
        }
      }
    }

    if (typeof IntersectionObserver === "undefined") {
      void loadImages();
      return () => {
        cancelled = true;
        controller?.abort();
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void loadImages();
        }
      },
      { rootMargin: "240px" },
    );

    observer.observe(root);

    return () => {
      cancelled = true;
      controller?.abort();
      observer.disconnect();
    };
  }, [coverImageSrc, initialImages, sectionImagesActive, staticImages, villaId]);

  function scrollThumbs(direction: "left" | "right") {
    setSelectedIndex((currentIndex) => {
      if (direction === "left") {
        return Math.max(currentIndex - 1, 0);
      }

      return Math.min(currentIndex + 1, galleryImages.length - 1);
    });
  }

  const galleryStatus = staticImages !== null
    ? staticImages.length >= MIN_GALLERY_CARD_IMAGES
      ? "ready"
      : "empty"
    : status;
  const galleryImages = staticImages ?? images;

  useEffect(() => {
    if (galleryStatus !== "ready") {
      return;
    }

    const selectedThumbnail = thumbnailRefs.current[selectedIndex];
    const thumbnailRail = thumbsRef.current;

    if (!selectedThumbnail || !thumbnailRail) {
      return;
    }

    const selectedCenter =
      selectedThumbnail.offsetLeft + selectedThumbnail.offsetWidth / 2;
    const targetLeft = Math.max(
      selectedCenter - thumbnailRail.clientWidth / 2,
      0,
    );

    if (typeof thumbnailRail.scrollTo === "function") {
      thumbnailRail.scrollTo({
        behavior: "smooth",
        left: targetLeft,
      });

      return;
    }

    thumbnailRail.scrollLeft = targetLeft;
  }, [galleryStatus, selectedIndex]);

  const selectedImage = galleryImages[selectedIndex] ?? coverImageSrc;

  if (!selectedImage) {
    return (
      <div
        ref={rootRef}
        className="grid h-[216px] place-items-center rounded-[23px] rounded-b-none bg-[var(--site-surface-tint)] text-sm font-semibold text-[var(--site-muted)]"
        data-villa-card-gallery-status="empty"
        data-villa-card-style="gallery"
      >
        ไม่มีรูปภาพ
      </div>
    );
  }

  const mainImage = (
    <ProgressiveImage
      src={selectedImage}
      alt={alt}
      fill
      previewActive={previewActive && sectionImagesActive}
      fullImageActive={coverImageActive && sectionImagesActive}
      fullImageLoading={imageLoading}
      fullImagePreload={preload && selectedIndex === 0}
      quality={60}
      sizes="(max-width: 640px) 290px, (max-width: 1024px) 50vw, 325px"
      className="object-cover transition duration-500"
    />
  );

  return (
    <div
      ref={rootRef}
      className="overflow-hidden rounded-[23px] rounded-b-none bg-[var(--site-surface-tint)]"
      data-villa-card-gallery-status={galleryStatus}
      data-villa-card-style="gallery"
    >
      {href ? (
        <a
          aria-label={alt}
          className="relative block h-[216px] w-full overflow-hidden"
          data-villa-card-main-image="true"
          data-villa-card-gallery-main-link="true"
          href={href}
        >
          {mainImage}
        </a>
      ) : (
        <div
          className="relative h-[216px] w-full overflow-hidden"
          data-villa-card-main-image="true"
        >
          {mainImage}
        </div>
      )}

      {galleryStatus === "ready" && sectionImagesActive ? (
        <div
          className="relative border-t border-white/70 bg-[var(--site-surface)] px-2 py-2"
          data-villa-card-thumbnail-strip
          data-scroll-rail-ignore-drag="true"
        >
          <button
            aria-label={`เลื่อนรูปย่อยของ ${alt} ไปทางซ้าย`}
            className="absolute left-3 top-1/2 z-10 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] shadow-md"
            onClick={() => {
              scrollThumbs("left");
            }}
            type="button"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div
            ref={thumbsRef}
            className="flex gap-2 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            data-villa-card-thumbnail-rail
          >
            {galleryImages.map((image, index) => (
              <button
                aria-label={`แสดงรูปที่ ${index + 1} ของ ${alt}`}
                aria-pressed={selectedIndex === index}
                className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border transition ${
                  selectedIndex === index
                    ? "border-[var(--site-primary)]"
                    : "border-transparent"
                }`}
                key={image}
                onClick={() => {
                  setSelectedIndex(index);
                }}
                ref={(element) => {
                  thumbnailRefs.current[index] = element;
                }}
                type="button"
              >
                <Image
                  src={image}
                  alt=""
                  fill
                  loading={index < 3 ? "eager" : "lazy"}
                  maximumWidth={300}
                  quality={60}
                  sizes="96px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
          <button
            aria-label={`เลื่อนรูปย่อยของ ${alt} ไปทางขวา`}
            className="absolute right-3 top-1/2 z-10 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] shadow-md"
            onClick={() => {
              scrollThumbs("right");
            }}
            type="button"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="h-20 border-t border-white/70 bg-[var(--site-surface)] px-2 py-2"
          data-villa-card-thumbnail-placeholder
        />
      )}
    </div>
  );
}
