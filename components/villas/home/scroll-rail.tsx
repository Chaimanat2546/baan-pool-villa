"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type ScrollRailProps = {
  children: ReactNode;
  className?: string;
  label: string;
  controlsClassName?: string;
};

export function ScrollRail({
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
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
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
        {canScrollLeft ? (
          <button
            type="button"
            aria-label={`เลื่อน${label}ไปทางซ้าย`}
            className="grid h-11 w-11 place-items-center rounded-full border border-[#dbe7e3] bg-white text-[#064e3b] shadow-[0_10px_24px_rgba(6,63,53,0.1)] transition hover:bg-[#f8fbf7]"
            onClick={() => scrollByPage("left")}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}

        {canScrollRight ? (
          <button
            type="button"
            aria-label={`เลื่อน${label}ไปทางขวา`}
            className="grid h-11 w-11 place-items-center rounded-full border border-[#dbe7e3] bg-white text-[#064e3b] shadow-[0_10px_24px_rgba(6,63,53,0.1)] transition hover:bg-[#f8fbf7]"
            onClick={() => scrollByPage("right")}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
