"use client";

import { useEffect } from "react";

function isHistoryNavigation() {
  const navigationEntry = performance.getEntriesByType(
    "navigation",
  )[0] as PerformanceNavigationTiming | undefined;

  return navigationEntry?.type === "back_forward";
}

/** Scroll restored browser-history visits to the top before deferred home content loads. */
export function HomeBackNavigationScroll() {
  useEffect(() => {
    const scrollToTop = () => window.scrollTo(0, 0);

    if (isHistoryNavigation()) {
      scrollToTop();
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        scrollToTop();
      }
    };

    window.addEventListener("pageshow", handlePageShow);

    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  return null;
}
