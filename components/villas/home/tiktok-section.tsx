"use client";

import { SiTiktok } from "react-icons/si";
import { X } from "lucide-react";
import { useMemo, useState } from "react";

import { ScrollRail } from "@/components/ui/scroll-rail";
import { useLockedBodyScroll } from "@/components/villas/detail/use-locked-body-scroll";
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
  videoId,
}: {
  onClose: () => void;
  videoId: string;
}) {
  return (
    <div
      aria-label="เล่นวิดีโอ TikTok"
      aria-modal="true"
      className="fixed inset-0 z-[90] grid place-items-center bg-black/82 p-3"
      data-tiktok-player-dialog
      role="dialog"
    >
      <button
        aria-label="ปิดวิดีโอ TikTok"
        className="absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-md bg-white text-[var(--site-text)] shadow-lg"
        onClick={onClose}
        type="button"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
      <div className="h-[88dvh] max-w-full aspect-[9/16] overflow-hidden rounded-lg bg-zinc-950 shadow-2xl">
        <TikTokPlayerFrame
          autoplay={false}
          className="h-full w-full border-0"
          title="TikTok video"
          videoId={videoId}
        />
      </div>
      <p className="mt-3 text-center text-sm font-medium text-white">
        แตะปุ่มเล่นในวิดีโอเพื่อเปิดเสียง
      </p>
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

      {dialogVideo ? (
        <TikTokPlayerDialog
          onClose={() => {
            setDialogVideoId(null);
          }}
          videoId={dialogVideo.videoId}
        />
      ) : null}
    </section>
  );
}
