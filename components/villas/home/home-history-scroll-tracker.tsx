"use client";

import { useEffect } from "react";

const HOME_LAST_SCROLL_Y_KEY = "home-last-scroll-y";

/** Tracks public-route history while the homepage itself is unmounted. */
export function HomeHistoryScrollTracker() {
  useEffect(() => {
    const rememberHomepageScroll = () => {
      if (window.location.pathname === "/") {
        window.sessionStorage.setItem(HOME_LAST_SCROLL_Y_KEY, String(window.scrollY));
      }
    };
    window.addEventListener("scroll", rememberHomepageScroll, { passive: true });
    window.addEventListener("pagehide", rememberHomepageScroll);

    return () => {
      window.removeEventListener("scroll", rememberHomepageScroll);
      window.removeEventListener("pagehide", rememberHomepageScroll);
    };
  }, []);

  return null;
}
