"use client";

import { useEffect } from "react";

const HOME_LAST_SCROLL_Y_KEY = "home-last-scroll-y";

function getLatestHomepageScrollY(): number | null {
  const savedScrollY = window.sessionStorage.getItem(HOME_LAST_SCROLL_Y_KEY);

  if (!savedScrollY) {
    return null;
  }

  const scrollY = Number(savedScrollY);

  return Number.isFinite(scrollY) && scrollY >= 0 ? scrollY : null;
}

function isReloadNavigation(): boolean {
  return performance
    .getEntriesByType("navigation")
    .some((entry) => (entry as PerformanceNavigationTiming).type === "reload");
}

/** Keeps client-side back navigation at its prior homepage position. */
export function HomeBackNavigationScroll() {
  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    const isReload = isReloadNavigation();
    const scrollYToRestore = isReload ? null : getLatestHomepageScrollY();

    if (isReload) {
      window.sessionStorage.removeItem(HOME_LAST_SCROLL_Y_KEY);
    }

    window.history.scrollRestoration = "manual";
    const restoreFrame = scrollYToRestore !== null
      ? window.requestAnimationFrame(() => window.scrollTo(0, scrollYToRestore))
      : null;

    if (scrollYToRestore === null) {
      window.scrollTo(0, 0);
    }

    return () => {
      if (restoreFrame !== null) {
        window.cancelAnimationFrame(restoreFrame);
      }

      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  return null;
}
