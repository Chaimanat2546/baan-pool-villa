"use client";

import AutoScroll from "embla-carousel-auto-scroll";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

interface ScrollRailProps {
  children: ReactNode;
  className?: string;
  label: string;
  controlsClassName?: string;
  autoScroll?: boolean;
  alwaysShowControls?: boolean;
  onActiveIndexChange?: (index: number) => void;
}

export function ScrollRail({
  alwaysShowControls = true,
  autoScroll = false,
  children,
  className,
  controlsClassName,
  label,
  onActiveIndexChange,
}: ScrollRailProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  const supportsEmbla =
    typeof window === "undefined" ||
    (typeof window.IntersectionObserver === "function" &&
      typeof window.ResizeObserver === "function");
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      window.matchMedia = () =>
        ({
          addEventListener: () => undefined,
          addListener: () => undefined,
          dispatchEvent: () => false,
          matches: false,
          media: "",
          onchange: null,
          removeEventListener: () => undefined,
          removeListener: () => undefined,
        }) as MediaQueryList;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  const plugins = useMemo(
    () =>
      autoScroll && !reducedMotion
        ? [
            AutoScroll({
              speed: 0.35,
              stopOnFocusIn: false,
              stopOnInteraction: true,
              stopOnMouseEnter: false,
            }),
          ]
        : [],
    [autoScroll, reducedMotion],
  );
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: "start",
      active: supportsEmbla,
      axis: "x",
      containScroll: "trimSnaps",
      dragFree: true,
      loop: false,
      watchDrag: (_, event) =>
        !(event.target instanceof Element &&
          event.target.closest("[data-scroll-rail-ignore-drag]")),

    },
    plugins,
  );

  const restartAutoScroll = useCallback(() => {
    const autoScrollPlugin = emblaApi?.plugins().autoScroll;
    autoScrollPlugin?.stop();
    autoScrollPlugin?.play(4_000);
  }, [emblaApi]);

  const pauseAutoScroll = useCallback(() => {
    emblaApi?.plugins().autoScroll?.stop();
  }, [emblaApi]);

  const reportActiveIndex = useCallback(() => {
    const index = emblaApi?.selectedScrollSnap();
    if (index !== undefined) onActiveIndexChange?.(index);
  }, [emblaApi, onActiveIndexChange]);

  useEffect(() => {
    if (!emblaApi || !onActiveIndexChange) return;

    reportActiveIndex();
    emblaApi.on("select", reportActiveIndex);
    return () => {
      emblaApi.off("select", reportActiveIndex);
    };
  }, [emblaApi, onActiveIndexChange, reportActiveIndex]);

  useEffect(() => {
    if (!autoScroll || !emblaApi) return;

    emblaApi.on("pointerUp", restartAutoScroll);
    return () => {
      emblaApi.off("pointerUp", restartAutoScroll);
    };
  }, [autoScroll, emblaApi, restartAutoScroll]);

  const scrollPrev = useCallback(() => {
    restartAutoScroll();
    emblaApi?.scrollPrev();
  }, [emblaApi, restartAutoScroll]);
  const scrollNext = useCallback(() => {
    restartAutoScroll();
    emblaApi?.scrollNext();
  }, [emblaApi, restartAutoScroll]);
  return (
    <div className="relative">
      <div
        data-scroll-rail-controls="sides"
        className="flex min-w-0 sm:items-center sm:gap-3"
      >
        <div
          className={cn(
            "hidden sm:flex shrink-0 min-h-11 items-center justify-center",
            controlsClassName,
          )}
        >
          {alwaysShowControls ? (
            <button
              type="button"
              aria-label={`เลื่อน${label}ไปทางซ้าย`}
              className={cn(
                "grid h-11 w-11 place-items-center rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] shadow-[0_10px_24px_rgba(6,63,53,0.1)] transition hover:bg-[var(--site-primary-soft)]",
              )}
              onClick={scrollPrev}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <div
          ref={emblaRef}
          data-scroll-rail-viewport="true"
          onMouseEnter={autoScroll ? pauseAutoScroll : undefined}
          onMouseLeave={autoScroll ? restartAutoScroll : undefined}
          className={cn(
            "min-w-0 flex-1 snap-x overflow-hidden",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden mx-2 lg:mx-0 md:mx-2",
            className,
          )}
        >
          <div className="flex min-w-0 touch-pan-y gap-5">
            {children}
          </div>
        </div>

        <div
          className={cn(
            "hidden sm:flex shrink-0 min-h-11 items-center justify-center",
            controlsClassName,
          )}
        >
          {alwaysShowControls ? (
            <button
              type="button"
              aria-label={`เลื่อน${label}ไปทางขวา`}
              className={cn(
                "grid h-11 w-11 place-items-center rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] shadow-[0_10px_24px_rgba(6,63,53,0.1)] transition hover:bg-[var(--site-primary-soft)]",
              )}
              onClick={scrollNext}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
