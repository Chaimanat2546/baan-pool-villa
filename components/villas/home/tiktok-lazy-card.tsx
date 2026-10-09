"use client";

import { ChevronRight, House, Play } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { SiTiktok } from "react-icons/si";

import { useImageActivation } from "@/components/ui/near-viewport-activation";
import { cn } from "@/lib/utils";
import type { TikTokVideoPreview } from "@/lib/tiktok/types";
import type { HomeTikTokVideo } from "./client-payload";

interface TikTokLazyCardProps {
  displayMode?: "grid" | "rail";
  index: number;
  isPlaying: boolean;
  onPlay: (videoId: string) => void;
  video: HomeTikTokVideo | TikTokVideoPreview;
}

/**
 * Builds a TikTok player URL for the given video ID.
 *
 * @returns The fully qualified TikTok player URL for the video (includes `autoplay`, `controls`, and `rel` query parameters).
 */
function getPlayerSrc(videoId: string, autoplay: boolean) {
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    controls: "1",
    rel: "0",
  });

  return `https://www.tiktok.com/player/v1/${videoId}?${params.toString()}`;
}

const TIKTOK_PLAYER_ORIGIN = "https://www.tiktok.com";

export function TikTokPlayerFrame({
  autoplay = true,
  className,
  title,
  videoId,
}: {
  autoplay?: boolean;
  className: string;
  title: string;
  videoId: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const requestPlaybackWithSound = useCallback(() => {
    const playerWindow = iframeRef.current?.contentWindow;

    if (!playerWindow) {
      return;
    }

    for (const type of ["play", "unMute"] as const) {
      playerWindow.postMessage(
        { "x-tiktok-player": true, type, value: undefined },
        TIKTOK_PLAYER_ORIGIN,
      );
    }
  }, []);

  useEffect(() => {
    if (!autoplay) {
      return;
    }

    function handlePlayerMessage(event: MessageEvent<unknown>) {
      if (
        event.origin !== TIKTOK_PLAYER_ORIGIN ||
        event.source !== iframeRef.current?.contentWindow ||
        typeof event.data !== "object" ||
        event.data === null
      ) {
        return;
      }

      const message = event.data as {
        "x-tiktok-player"?: unknown;
        type?: unknown;
      };

      if (
        message["x-tiktok-player"] === true &&
        message.type === "onPlayerReady"
      ) {
        requestPlaybackWithSound();
      }
    }

    window.addEventListener("message", handlePlayerMessage);

    return () => {
      window.removeEventListener("message", handlePlayerMessage);
    };
  }, [autoplay, requestPlaybackWithSound]);

  return (
    <iframe
      allow="autoplay; fullscreen"
      className={className}
      loading="eager"
      ref={iframeRef}
      src={getPlayerSrc(videoId, autoplay)}
      title={title}
    />
  );
}

/**
 * Render an iframe TikTok player for the given video.
 *
 * @param index - Zero-based position of the video; used in the iframe title for accessibility
 * @param video - Video data containing `videoId` used to construct the player `src`
 * @returns The configured `<iframe>` element that embeds the TikTok player with autoplay and fullscreen enabled
 */
function TikTokPlayer({
  autoplay,
  index,
  video,
}: Pick<TikTokLazyCardProps, "index" | "video"> & { autoplay: boolean }) {
  return (
    <TikTokPlayerFrame
      autoplay={autoplay}
      className="h-full w-full border-0"
      title={`TikTok video ${index + 1}`}
      videoId={video.videoId}
    />
  );
}

/**
 * Render a TikTok video card that lazy-mounts TikTok's player near the viewport.
 *
 * @param index - Zero-based index used for display, accessibility labels, and the iframe title.
 * @param video - Video metadata used to build the player URL and fallback label.
 * @returns The card element that keeps a lightweight fallback until its player activates.
 */
export function TikTokLazyCard({
  displayMode = "rail",
  index,
  isPlaying,
  onPlay,
  video,
}: TikTokLazyCardProps) {
  const playerActive = useImageActivation();
  const title =
    "title" in video && video.title.trim().length > 0
      ? video.title.trim()
      : `video/${video.videoId}`;
  const authorName =
    "authorName" in video && video.authorName.trim().length > 0
      ? video.authorName.trim()
      : "TikTok";
  const villa = "villa" in video ? video.villa : null;
  const showPlayer = playerActive || isPlaying;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-[0_12px_30px_rgba(15,47,53,0.08)]",
        displayMode === "grid"
          ? "min-w-0 w-full"
          : "w-[244px] flex-shrink-0 snap-start sm:w-[292px] lg:w-[320px]",
      )}
    >
      <div className="relative aspect-[9/16] bg-[var(--site-surface-soft)]">
        {showPlayer ? <TikTokPlayer autoplay={isPlaying} index={index} video={video} /> : null}
        {!isPlaying ? (
          <button
            type="button"
            className="group absolute inset-0 grid h-full w-full place-items-center overflow-hidden text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-accent)] focus-visible:ring-offset-2"
            data-tiktok-poster
            onClick={() => {
              onPlay(video.videoId);
            }}
          >
            {!showPlayer ? (
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-[linear-gradient(145deg,color-mix(in_srgb,var(--site-primary)_86%,black),color-mix(in_srgb,var(--site-primary)_34%,white)_48%,color-mix(in_srgb,var(--site-accent)_42%,white))]"
              />
            ) : null}
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/65 to-transparent"
            />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
              <SiTiktok aria-hidden="true" className="size-3.5" />
              {authorName}
            </span>
            <span className="absolute bottom-3 left-3 right-3 min-w-0">
              <span className="line-clamp-2 text-sm font-semibold leading-5 text-white">
                {title}
              </span>
              <span className="mt-1 block text-xs text-white/80">
                กดเพื่อเล่นวิดีโอ
              </span>
            </span>
            <span className="relative grid size-16 place-items-center rounded-full bg-white/90 text-[var(--site-primary)] shadow-[0_18px_34px_rgba(0,0,0,0.25)] transition group-hover:scale-105">
              <Play aria-hidden="true" className="ml-1 size-7 fill-current" />
            </span>
            <span className="sr-only">เล่นวิดีโอ TikTok รายการที่ {index + 1}</span>
          </button>
        ) : null}
      </div>
      {villa ? (
        <a
          className="flex min-w-0 items-center gap-2 border-t border-[var(--site-border)] bg-[var(--site-primary-soft)] px-2.5 py-2.5 text-[var(--site-primary)] transition hover:bg-[var(--site-primary)] hover:text-[var(--site-on-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-accent)] focus-visible:ring-inset sm:gap-3 sm:px-4 sm:py-3"
          href={`/villas/${villa.id}`}
        >
          <span className="hidden size-8 shrink-0 items-center justify-center rounded-md bg-[var(--site-surface)] text-[var(--site-primary)] shadow-sm sm:inline-flex sm:size-9">
            <House aria-hidden="true" className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block text-xs font-medium opacity-80 sm:hidden"
              data-tiktok-villa-mobile-label
            >
              ดูบ้านพัก
            </span>
            <span className="hidden text-xs font-medium opacity-80 sm:block">
              ดูรายละเอียดบ้านพัก
            </span>
            <span className="block truncate text-sm font-semibold">
              {villa.title}
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="size-4 shrink-0 sm:size-5" />
        </a>
      ) : null}
    </article>
  );
}
