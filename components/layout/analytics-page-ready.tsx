"use client";
import { useEffect } from "react";
import { track } from "@/lib/analytics/client";
let lastPath: string | null = null;
let mounts = 0;
export function AnalyticsPageReady({
  villaId = null,
  pagePath,
}: {
  villaId?: string | null;
  pagePath?: string;
}) {
  useEffect(() => {
    mounts++;
    const path = pagePath ?? window.location.pathname;
    const send = () =>
      track({
        event_name: "page_view",
        channel: null,
        villa_id: villaId,
        page_path: path,
      });
    if (lastPath !== path) {
      lastPath = path;
      send();
    }
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) {
        lastPath = path;
        send();
      }
    };
    const leave = () => {
      lastPath = null;
    };
    window.addEventListener("pageshow", restore);
    window.addEventListener("pagehide", leave);
    return () => {
      mounts--;
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("pagehide", leave);
      queueMicrotask(() => {
        if (mounts === 0) lastPath = null;
      });
    };
  }, [villaId, pagePath]);
  return null;
}
