"use client";

import { SiTiktok } from "react-icons/si";
import { useMemo, useState } from "react";

import { ScrollRail } from "@/components/ui/scroll-rail";
import { selectHomeTikTokVideos } from "./client-payload";
import type { SiteTikTokSettings } from "@/lib/site-settings/types";
import type { TikTokPreviewSettings } from "@/lib/tiktok/types";
import { TikTokLazyCard } from "./tiktok-lazy-card";

interface TikTokSectionProps {
  tiktok: SiteTikTokSettings | TikTokPreviewSettings;
}

/**
 * Render a homepage TikTok section with a scrollable rail for up to six videos or a three-column grid for more, plus an optional follow link.
 *
 * Renders nothing if there are no valid videos to display.
 *
 * @param tiktok - TikTok settings (site or preview) that provide `videos` and an `accountUrl`; video IDs are trimmed, deduplicated, and limited before rendering.
 * @returns A section element containing the TikTok header, its video cards, and an optional "Follow us on TikTok" link, or `null` when no videos are available.
 */
export function TikTokSection({ tiktok }: TikTokSectionProps) {
  const videos = useMemo(() => selectHomeTikTokVideos(tiktok), [tiktok]);
  const accountUrl = useMemo(() => {
    const rawAccountUrl = tiktok.accountUrl.trim();

    if (!rawAccountUrl) {
      return null;
    }

    try {
      const parsedUrl = new URL(rawAccountUrl);

      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return null;
      }

      return parsedUrl.href;
    } catch {
      return null;
    }
  }, [tiktok.accountUrl]);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const useGridLayout = videos.length > 6;

  if (videos.length === 0) {
    return null;
  }

  return (
    <section
      className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
      data-home-tiktok
    >
      <div className="text-center">
        <h1 className="text-3xl font-black text-[var(--site-text)] md:text-4xl">
          TikTok
        </h1>
      </div>

      {useGridLayout ? (
        <div
          className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:gap-6"
          data-tiktok-grid
        >
          {videos.map((video, index) => (
            <TikTokLazyCard
              displayMode="grid"
              index={index}
              isPlaying={activeVideoId === video.videoId}
              key={video.videoId}
              onPlay={setActiveVideoId}
              video={video}
            />
          ))}
        </div>
      ) : (
        <ScrollRail
          alwaysShowControls
          className="-mx-4 mt-8 gap-4 px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:gap-6 lg:px-8"
          controlsClassName="mt-5"
          label="วิดีโอ TikTok"
        >
          {videos.map((video, index) => (
            <TikTokLazyCard
              index={index}
              isPlaying={activeVideoId === video.videoId}
              key={video.videoId}
              onPlay={setActiveVideoId}
              video={video}
            />
          ))}
        </ScrollRail>
      )}

      {accountUrl ? (
        <div className="mt-8 flex justify-center">
          <a
            className="inline-flex items-center gap-2 rounded-full border border-[var(--site-primary)] px-5 py-3 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary)] hover:text-[var(--site-on-primary)]"
            href={accountUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <SiTiktok aria-hidden="true" className="size-5" />
            ติดตามพวกเราบน TikTok
          </a>
        </div>
      ) : null}
    </section>
  );
}
