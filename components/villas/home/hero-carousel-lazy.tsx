"use client";

import { useEffect, useState, type ReactNode } from "react";

import type { HeroCarouselSlide } from "./hero-carousel";

type LoadedCarousel = typeof import("./hero-carousel").HeroCarousel;

function scheduleWhenIdle(callback: () => void) {
  const idleWindow = window as Window & {
    requestIdleCallback?: (next: () => void, options?: { timeout: number }) => number;
  };

  if (idleWindow.requestIdleCallback) {
    const idleId = idleWindow.requestIdleCallback(callback, { timeout: 1500 });

    return () => window.cancelIdleCallback?.(idleId);
  }

  const timeoutId = window.setTimeout(callback, 250);
  return () => window.clearTimeout(timeoutId);
}

export function HeroCarouselLazy({ children, slides }: { children: ReactNode; slides: HeroCarouselSlide[] }) {
  const [Carousel, setCarousel] = useState<LoadedCarousel | null>(null);

  useEffect(() => scheduleWhenIdle(() => {
    void import("./hero-carousel").then((module) => setCarousel(() => module.HeroCarousel));
  }), []);

  return Carousel ? <Carousel slides={slides} /> : children;
}
