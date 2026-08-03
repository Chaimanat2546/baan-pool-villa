"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface ScrollRailProps {
  children: ReactNode;
  className?: string;
  label: string;
  controlsClassName?: string;
  autoScroll?: boolean;
  alwaysShowControls?: boolean;
}

export function ScrollRail({
  alwaysShowControls = true,
  autoScroll = false,
  children,
  className,
  controlsClassName,
  label,
}: ScrollRailProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
    setCanScrollLeft(scroller.scrollLeft > 2);
    setCanScrollRight(scroller.scrollLeft < maxScrollLeft - 2);
  }, []);

  const scrollByPage = useCallback((direction: "left" | "right") => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    const distance = Math.max(scroller.clientWidth * 0.82, 280);
    scroller.scrollBy({
      behavior: "smooth",
      left: direction === "left" ? -distance : distance,
    });
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    updateScrollState();
    scroller.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      scroller.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!autoScroll || !scroller || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let previous = 0;
    let paused = false;
    const pause = () => { paused = true; };
    const resume = () => { paused = false; };
    const advance = (time: number) => {
      const max = scroller.scrollWidth - scroller.clientWidth;
      if (!paused && !document.hidden && max > 0) {
        const elapsed = previous ? time - previous : 0;
        scroller.scrollLeft = scroller.scrollLeft >= max ? 0 : Math.min(max, scroller.scrollLeft + elapsed * 0.025);
      }
      previous = time;
      frame = requestAnimationFrame(advance);
    };
    scroller.addEventListener("pointerenter", pause);
    scroller.addEventListener("pointerleave", resume);
    scroller.addEventListener("pointerdown", pause);
    scroller.addEventListener("pointerup", resume);
    scroller.addEventListener("touchstart", pause, { passive: true });
    scroller.addEventListener("touchend", resume, { passive: true });
    frame = requestAnimationFrame(advance);
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("pointerenter", pause);
      scroller.removeEventListener("pointerleave", resume);
      scroller.removeEventListener("pointerdown", pause);
      scroller.removeEventListener("pointerup", resume);
      scroller.removeEventListener("touchstart", pause);
      scroller.removeEventListener("touchend", resume);
    };
  }, [autoScroll]);
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
          {alwaysShowControls || canScrollLeft ? (
            <button
              type="button"
              aria-label={`เลื่อน${label}ไปทางซ้าย`}
              className={cn(
                "grid h-11 w-11 place-items-center rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] shadow-[0_10px_24px_rgba(6,63,53,0.1)] transition hover:bg-[var(--site-primary-soft)]",
                !canScrollLeft &&
                  "cursor-not-allowed opacity-45 hover:bg-[var(--site-surface)]",
              )}
              disabled={!canScrollLeft}
              onClick={() => {
                scrollByPage("left");
              }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <div
          ref={scrollerRef}
          className={cn(
            "min-w-0 flex-1 flex snap-x overflow-x-auto scroll-smooth",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden mx-2 lg:mx-0 md:mx-2",
            className,
          )}
        >
          {children}
        </div>

        <div
          className={cn(
            "hidden sm:flex shrink-0 min-h-11 items-center justify-center",
            controlsClassName,
          )}
        >
          {alwaysShowControls || canScrollRight ? (
            <button
              type="button"
              aria-label={`เลื่อน${label}ไปทางขวา`}
              className={cn(
                "grid h-11 w-11 place-items-center rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] shadow-[0_10px_24px_rgba(6,63,53,0.1)] transition hover:bg-[var(--site-primary-soft)]",
                !canScrollRight &&
                  "cursor-not-allowed opacity-45 hover:bg-[var(--site-surface)]",
              )}
              disabled={!canScrollRight}
              onClick={() => {
                scrollByPage("right");
              }}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
