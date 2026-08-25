"use client";

import { useEffect } from "react";

/** Keep homepage visits at the hero instead of restoring a prior scroll position. */
export function HomeBackNavigationScroll() {
  useEffect(() => {
    const scrollToTop = () => window.scrollTo(0, 0);
    const previousScrollRestoration = window.history.scrollRestoration;

    window.history.scrollRestoration = "manual";
    scrollToTop();

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        scrollToTop();
      }
    };

    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  return null;
}
