"use client";

import { SiTiktok } from "react-icons/si";
import { ExternalLink, X } from "lucide-react";
import { useMemo, useState } from "react";

import { ScrollRail } from "@/components/ui/scroll-rail";
import { useLockedBodyScroll } from "@/components/villas/detail/use-locked-body-scroll";
import { getTikTokWatchUrl } from "@/lib/site-settings/validation";
import {
  selectHomeTikTokVideos,
  type HomeTikTokSettings,
} from "./client-payload";
import type { TikTokPreviewSettings } from "@/lib/tiktok/types";
import { TikTokLazyCard, TikTokPlayerFrame } from "./tiktok-lazy-card";

interface TikTokSectionProps {
  tiktok: HomeTikTokSettings | TikTokPreviewSettings;
}

function TikTokPlayerDialog({
  onClose,
  videoUrl,
  videoId,
}: {
  onClose: () => void;
  videoUrl: string;
  videoId: string;
}) {
  const watchUrl = getTikTokWatchUrl(videoUrl, videoId);

  return (
    <div
      aria-label="เล่นวิดีโอ TikTok"
      aria-modal="true"
      className="fixed inset-0 z-[90] grid grid-rows-[auto_minmax(0,1fr)_auto] gap-2 bg-black/82 p-3"
      data-tiktok-player-dialog
      role="dialog"
    >
      <button
        aria-label="ปิดวิดีโอ TikTok"
        className="grid size-11 place-items-center justify-self-end rounded-md bg-white text-[var(--site-text)] shadow-lg"
        onClick={onClose}
        type="button"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
      <div className="aspect-[9/16] h-full max-h-[calc((100vw_-_1.5rem)*16/9)] max-w-full place-self-center overflow-hidden rounded-lg bg-zinc-950 shadow-2xl">
        <TikTokPlayerFrame
          autoplay={false}
          className="h-full w-full border-0"
          title="TikTok video"
          videoId={videoId}
        />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-sm font-medium text-white">
        <p>แตะปุ่มเล่นในวิดีโอเพื่อเปิดเสียง</p>
        {watchUrl ? (
          <a
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
            href={watchUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
            เปิดคลิปใน TikTok
          </a>
        ) : null}
      </div>
    </div>
  );
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
  const [dialogVideoId, setDialogVideoId] = useState<string | null>(null);
  const useGridLayout = videos.length > 6;
  const dialogVideo = videos.find((video) => video.videoId === dialogVideoId);

  useLockedBodyScroll(dialogVideo !== undefined);

  function handlePlay(videoId: string) {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setDialogVideoId(null);
      setActiveVideoId(videoId);
      return;
    }

    setActiveVideoId(null);
    setDialogVideoId(videoId);
  }

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
          className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:mx-auto lg:max-w-5xl lg:gap-6"
          data-tiktok-grid
        >
          {videos.map((video, index) => (
            <TikTokLazyCard
              displayMode="grid"
              index={index}
              isPlaying={activeVideoId === video.videoId}
              key={video.videoId}
              onPlay={handlePlay}
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
              onPlay={handlePlay}
              video={video}
            />
          ))}
        </ScrollRail>
      )}

      {accountUrl ? (
        <div className="mt-8 flex justify-center">
          <a
            className="inline-flex items-center gap-2 rounded-full border border-[var(--site-primary)] px-5 py-3 text-sm font-semibold text-[var(--site-primary-text)] transition hover:bg-[var(--site-primary-action)] hover:text-[var(--site-on-primary-action)]"
            href={accountUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <SiTiktok aria-hidden="true" className="size-5" />
            ติดตามพวกเราบน TikTok
          </a>
        </div>
      ) : null}

      {dialogVideo ? (
        <TikTokPlayerDialog
          onClose={() => {
            setDialogVideoId(null);
          }}
          videoId={dialogVideo.videoId}
          videoUrl={dialogVideo.url}
        />
      ) : null}
    </section>
  );
}
