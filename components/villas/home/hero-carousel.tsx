"use client";

import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState, type KeyboardEvent } from "react";

import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";

export interface HeroCarouselSlide {
  alt: string;
  src: string;
}

interface HeroCarouselProps {
  slides: HeroCarouselSlide[];
}

const AUTO_ADVANCE_DELAY_MS = 5000;

export function HeroCarousel({ slides }: HeroCarouselProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const hasMultipleSlides = slides.length > 1;
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true },
    [
      Autoplay({
        delay: AUTO_ADVANCE_DELAY_MS,
        stopOnInteraction: false,
      }),
    ],
  );

  const updateSelectedIndex = useCallback(() => {
    if (emblaApi) {
      setSelectedIndex(emblaApi.selectedScrollSnap());
    }
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) {
      return;
    }

    emblaApi.on("select", updateSelectedIndex);

    return () => {
      emblaApi.off("select", updateSelectedIndex);
    };
  }, [emblaApi, updateSelectedIndex]);

  const scrollPrevious = useCallback(() => {
    emblaApi?.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollPrevious();
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollNext();
    }
  }

  if (slides.length === 0) {
    return (
      <div
        aria-hidden="true"
        className="aspect-[1565/1043] w-full bg-[var(--site-surface-tint)]"
      />
    );
  }

  return (
    <div
      aria-label="ภาพแนะนำบ้านพัก"
      aria-roledescription="carousel"
      className="relative aspect-[1565/1043] w-full overflow-hidden bg-[var(--site-surface-tint)]"
      data-hero-carousel={hasMultipleSlides ? "true" : undefined}
      onKeyDown={handleKeyDown}
      role="region"
      tabIndex={hasMultipleSlides ? 0 : undefined}
    >
      <div className="h-full overflow-hidden" ref={emblaRef}>
        <div className="flex h-full touch-pan-y">
          {slides.map((slide) => (
            <div className="relative min-w-0 flex-[0_0_100%]" key={slide.src}>
              <Image
                alt={slide.alt}
                className="object-contain"
                fill
                loading={slide === slides[0] ? "eager" : undefined}
                preload={slide === slides[0]}
                quality={75}
                sizes="100vw"
                src={slide.src}
              />
            </div>
          ))}
        </div>
      </div>

      {hasMultipleSlides ? (
        <>
          <button
            aria-label="รูป Hero ก่อนหน้า"
            className="absolute left-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/50 bg-black/35 text-white shadow-sm transition hover:bg-black/55 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black/30 sm:left-5"
            onClick={scrollPrevious}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="size-6" />
          </button>
          <button
            aria-label="รูป Hero ถัดไป"
            className="absolute right-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/50 bg-black/35 text-white shadow-sm transition hover:bg-black/55 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black/30 sm:right-5"
            onClick={scrollNext}
            type="button"
          >
            <ChevronRight aria-hidden="true" className="size-6" />
          </button>
          <div
            aria-label={`รูป Hero ${selectedIndex + 1} จาก ${slides.length}`}
            className="absolute inset-x-0 bottom-4 z-10 flex justify-center gap-2"
          >
            {slides.map((slide, index) => (
              <button
                aria-current={selectedIndex === index ? "true" : undefined}
                aria-label={`แสดงรูป Hero ที่ ${index + 1}`}
                className={`h-2.5 rounded-full transition focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black/30 ${
                  selectedIndex === index
                    ? "w-6 bg-white"
                    : "w-2.5 bg-white/60 hover:bg-white"
                }`}
                key={slide.src}
                onClick={() => {
                  emblaApi?.scrollTo(index);
                }}
                type="button"
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
