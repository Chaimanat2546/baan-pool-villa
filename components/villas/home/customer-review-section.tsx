"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";

import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { useImageActivation } from "@/components/ui/near-viewport-activation";
import { useLockedBodyScroll } from "@/components/villas/detail/use-locked-body-scroll";
import type {
  HomepageCustomerReviewData,
  HomepageCustomerReviewImage,
} from "@/lib/customer-reviews/types";

interface CustomerReviewSectionProps {
  data: HomepageCustomerReviewData;
}

function ReviewImageButton({
  className = "",
  image,
  index,
  onOpen,
  sizes,
}: {
  className?: string;
  image: HomepageCustomerReviewImage;
  index: number;
  onOpen: (index: number) => void;
  sizes: string;
}) {
  const imageActive = useImageActivation();

  return (
    <button
      aria-label={image.alt}
      className={`group relative min-w-0 overflow-hidden rounded-lg bg-[var(--site-surface)] text-left shadow-sm ring-1 ring-[var(--site-border)] transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--site-primary)] ${className}`}
      onClick={() => {
        onOpen(index);
      }}
      type="button"
    >
      <ProgressiveImage
        alt={image.alt}
        className="object-cover transition duration-300 group-hover:scale-[1.03]"
        fill
        fullImageActive={imageActive}
        fullImageLoading="lazy"
        previewActive={imageActive}
        quality={75}
        sizes={sizes}
        src={image.url}
      />
    </button>
  );
}

function getProofWallAspect(index: number): string {
  const pattern = [
    "aspect-[4/5]",
    "aspect-[1/1]",
    "aspect-[5/6]",
    "aspect-[4/3]",
    "aspect-[3/4]",
    "aspect-[1/1]",
  ];

  return pattern[index % pattern.length];
}

function FeaturedRailLayout({
  images,
  onOpen,
}: {
  images: HomepageCustomerReviewImage[];
  onOpen: (index: number) => void;
}) {
  const [featuredImage, ...railImages] = images;
  const sideImages = railImages.slice(0, 6);
  const overflowImages = railImages.slice(6);

  if (!featuredImage) {
    return null;
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 lg:grid-cols-5 lg:grid-rows-2 lg:items-stretch">
        <ReviewImageButton
          className="aspect-[4/5] w-full lg:col-span-2 lg:row-span-2"
          image={featuredImage}
          index={0}
          onOpen={onOpen}
          sizes="(min-width: 1280px) 560px, (min-width: 1024px) 40vw, 100vw"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:contents">
          {sideImages.map((image, index) => (
            <ReviewImageButton
              className="aspect-[4/5] w-full"
              image={image}
              index={index + 1}
              key={image.id}
              onOpen={onOpen}
              sizes="(min-width: 1280px) 270px, (min-width: 1024px) 18vw, 50vw"
            />
          ))}
        </div>
      </div>
      {overflowImages.length > 0 ? (
        <div
          className={`-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 ${
            overflowImages.length < 4 ? "justify-center" : ""
          }`}
        >
          {overflowImages.map((image, index) => (
            <ReviewImageButton
              className="aspect-[4/5] w-36 shrink-0 sm:w-44 lg:w-48"
              image={image}
              index={index + 7}
              key={image.id}
              onOpen={onOpen}
              sizes="192px"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProofWallLayout({
  images,
  onOpen,
}: {
  images: HomepageCustomerReviewImage[];
  onOpen: (index: number) => void;
}) {
  return (
    <div className="columns-2 gap-3 md:columns-3 xl:columns-4">
      {images.map((image, index) => (
        <ReviewImageButton
          className={`mb-3 w-full break-inside-avoid ${getProofWallAspect(index)}`}
          image={image}
          index={index}
          key={image.id}
          onOpen={onOpen}
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
        />
      ))}
    </div>
  );
}

function CarouselLayout({
  images,
  onOpen,
}: {
  images: HomepageCustomerReviewImage[];
  onOpen: (index: number) => void;
}) {
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
      {images.map((image, index) => (
        <ReviewImageButton
          className="aspect-[4/5] w-[78vw] shrink-0 snap-center sm:w-[18rem] lg:w-[20rem]"
          image={image}
          index={index}
          key={image.id}
          onOpen={onOpen}
          sizes="(min-width: 1024px) 320px, 78vw"
        />
      ))}
    </div>
  );
}

function ReviewLightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: HomepageCustomerReviewImage[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const activeImage = images[activeIndex];
  const hasMultipleImages = images.length > 1;

  if (!activeImage) {
    return null;
  }

  function move(direction: -1 | 1) {
    setActiveIndex((currentIndex) =>
      (currentIndex + direction + images.length) % images.length,
    );
  }

  return (
    <div
      aria-label="ดูรูปรีวิวลูกค้า"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/82 p-3"
      role="dialog"
    >
      <button
        aria-label="ปิดรูปรีวิว"
        className="absolute right-3 top-3 z-20 grid size-11 place-items-center rounded-md bg-white text-[var(--site-text)] shadow-lg"
        onClick={onClose}
        type="button"
      >
        <X aria-hidden="true" className="size-5" />
      </button>

      {hasMultipleImages ? (
        <>
          <button
            aria-label="รูปก่อนหน้า"
            className="absolute left-3 top-1/2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-md bg-white text-[var(--site-text)] shadow-lg"
            onClick={() => {
              move(-1);
            }}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="size-6" />
          </button>
          <button
            aria-label="รูปถัดไป"
            className="absolute right-3 top-1/2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-md bg-white text-[var(--site-text)] shadow-lg"
            onClick={() => {
              move(1);
            }}
            type="button"
          >
            <ChevronRight aria-hidden="true" className="size-6" />
          </button>
        </>
      ) : null}

      <figure className="grid max-h-[92dvh] w-full max-w-5xl grid-rows-[minmax(0,1fr)_auto] gap-3">
        <div className="relative min-h-[60dvh] overflow-hidden rounded-lg bg-zinc-950">
          <Image
            alt={activeImage.alt}
            className="object-contain"
            fill
            loading="eager"
            quality={75}
            sizes="(min-width: 1024px) 1024px, calc(100vw - 2rem)"
            src={activeImage.url}
          />
        </div>
        <figcaption className="rounded-md bg-white px-4 py-3 text-sm font-semibold text-[var(--site-text)] shadow">
          รูปที่ {(activeIndex + 1).toLocaleString("th-TH")} จาก{" "}
          {images.length.toLocaleString("th-TH")}
        </figcaption>
      </figure>
    </div>
  );
}

export function CustomerReviewSection({ data }: CustomerReviewSectionProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const images = useMemo(() => data.images.slice(0, 20), [data.images]);
  const [previousImages, setPreviousImages] = useState(images);

  if (images !== previousImages) {
    setPreviousImages(images);
    if (lightboxIndex !== null && images[lightboxIndex] === undefined) {
      setLightboxIndex(null);
    }
  }

  const activeLightboxImage =
    lightboxIndex === null ? undefined : images[lightboxIndex];

  useLockedBodyScroll(activeLightboxImage !== undefined);

  const isFeaturedLayout = data.layout === "featured_rail";

  if (images.length === 0) {
    return null;
  }

  return (
    <section
      className="bg-[var(--site-surface)] py-12 sm:py-16"
      data-home-customer-reviews={data.layout}
      id="customer-reviews"
    >
      <div
        className={`mx-auto grid w-full gap-6 px-4 sm:px-6 lg:px-8 ${
          isFeaturedLayout ? "max-w-[88rem]" : "max-w-7xl"
        }`}
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="text-sm font-bold text-[var(--site-primary)]">
              รีวิวจริงจากลูกค้า
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[var(--site-text)] sm:text-3xl">
              เครดิตการจองและความไว้ใจจากผู้เข้าพัก
            </h2>
          </div>
        </div>

        {data.layout === "featured_rail" ? (
          <FeaturedRailLayout images={images} onOpen={setLightboxIndex} />
        ) : data.layout === "carousel" ? (
          <CarouselLayout images={images} onOpen={setLightboxIndex} />
        ) : (
          <ProofWallLayout images={images} onOpen={setLightboxIndex} />
        )}
      </div>

      {lightboxIndex !== null && activeLightboxImage !== undefined ? (
        <ReviewLightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={() => {
            setLightboxIndex(null);
          }}
        />
      ) : null}
    </section>
  );
}
