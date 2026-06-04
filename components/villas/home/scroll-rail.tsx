"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface ScrollRailProps {
  children: ReactNode;
  className?: string;
  label: string;
  controlsClassName?: string;
  alwaysShowControls?: boolean;
}

/**
 * A horizontally scrollable container that optionally shows left/right pagination controls.
 *
 * Renders children inside a horizontal scroller and displays left/right buttons when scrolling is possible or when `alwaysShowControls` is true. Buttons are keyboard- and screen-reader-friendly via `aria-label`.
 *
 * @param alwaysShowControls - When true, render pagination controls even if scrolling is not currently possible (default: `true`).
 * @param label - Text used in the `aria-label` for the left/right buttons to describe the content being scrolled.
 * @param className - Additional class names applied to the scroll container.
 * @param controlsClassName - Additional class names applied to the controls wrapper.
 * @returns The ScrollRail React element containing the scrollable content and optional controls.
 */
export function ScrollRail({
  alwaysShowControls = true,
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

  return (
    <div>
      <div
        ref={scrollerRef}
        className={cn(
          "flex snap-x overflow-x-auto scroll-smooth",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden mx-2 lg:mx-0 md:mx-2",
          className,
        )}
      >
        {children}
      </div>

      <div
        className={cn(
          "mt-3 hidden min-h-11 items-center justify-center gap-2 sm:flex",
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
  );
}
