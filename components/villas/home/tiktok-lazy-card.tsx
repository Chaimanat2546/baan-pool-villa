"use client";

import { Play } from "lucide-react";
import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import { useEffect, useState } from "react";
import { SiTiktok } from "react-icons/si";

import type { SiteTikTokVideoSettings } from "@/lib/site-settings/types";
import type { TikTokVideoPreview } from "@/lib/tiktok/types";
import { loadTikTokClientOEmbed, type TikTokClientOEmbed } from "./tiktok-client-oembed";

interface TikTokLazyCardProps {
  index: number;
  isPlaying: boolean;
  onPlay: (videoId: string) => void;
  video: SiteTikTokVideoSettings | TikTokVideoPreview;
}

/**
 * Builds a TikTok player URL for the given video ID.
 *
 * @returns The fully qualified TikTok player URL for the video (includes `autoplay`, `controls`, and `rel` query parameters).
 */
function getPlayerSrc(videoId: string) {
  const params = new URLSearchParams({
    autoplay: "1",
    controls: "1",
    rel: "0",
  });

  return `https://www.tiktok.com/player/v1/${videoId}?${params.toString()}`;
}

/**
 * Type guard that detects whether a video object contains a non-empty thumbnail URL.
 *
 * When this function returns `true`, the `video` value is narrowed to `TikTokVideoPreview`.
 *
 * @param video - The video object to inspect
 * @returns `true` if `video.thumbnailUrl` exists and is not empty after trimming, `false` otherwise.
 */
function hasThumbnail(
  video: SiteTikTokVideoSettings | TikTokVideoPreview,
): video is TikTokVideoPreview {
  return "thumbnailUrl" in video && video.thumbnailUrl.trim().length > 0;
}

/**
 * Render an iframe TikTok player for the given video.
 *
 * @param index - Zero-based position of the video; used in the iframe title for accessibility
 * @param video - Video data containing `videoId` used to construct the player `src`
 * @returns The configured `<iframe>` element that embeds the TikTok player with autoplay and fullscreen enabled
 */
function TikTokPlayer({
  index,
  video,
}: Pick<TikTokLazyCardProps, "index" | "video">) {
  return (
    <iframe
      allow="autoplay; fullscreen"
      className="h-full w-full border-0"
      loading="eager"
      src={getPlayerSrc(video.videoId)}
      title={`TikTok video ${index + 1}`}
    />
  );
}

/**
 * Render a TikTok "lazy" video card that displays a poster (thumbnail or gradient) and replaces it with an embedded player when played.
 *
 * @param index - Zero-based index used for display, accessibility labels, and the iframe title.
 * @param video - Video metadata or preview object; if it contains a non-empty `thumbnailUrl`, a poster image is shown, otherwise a gradient poster is used. Title and author fall back to sensible defaults when missing.
 * @returns The card element that toggles between a poster view and an embedded TikTok iframe when activated.
 */
export function TikTokLazyCard({
  index,
  isPlaying,
  onPlay,
  video,
}: TikTokLazyCardProps) {
  const [clientPreview, setClientPreview] = useState<TikTokClientOEmbed | null>(
    null,
  );
  const thumbnailUrl = hasThumbnail(video)
    ? video.thumbnailUrl.trim()
    : (clientPreview?.thumbnailUrl ?? "");
  const title =
    "title" in video && video.title.trim().length > 0
      ? video.title.trim()
      : clientPreview?.title
        ? clientPreview.title
      : `video/${video.videoId}`;
  const authorName =
    "authorName" in video && video.authorName.trim().length > 0
      ? video.authorName.trim()
      : clientPreview?.authorName
        ? clientPreview.authorName
      : "TikTok";

  useEffect(() => {
    if (hasThumbnail(video) || isPlaying || !video.url.trim()) {
      return;
    }

    const controller = new AbortController();

    void loadTikTokClientOEmbed(video.url, controller.signal).then((metadata) => {
      if (metadata) {
        setClientPreview(metadata);
      }
    });

    return () => {
      controller.abort();
    };
  }, [isPlaying, video]);

  return (
    <article className="w-[244px] flex-shrink-0 snap-start overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-[0_12px_30px_rgba(15,47,53,0.08)] sm:w-[292px] lg:w-[320px]">
      <div className="relative aspect-[9/16] bg-[var(--site-surface-soft)]">
        {isPlaying ? (
          <TikTokPlayer index={index} video={video} />
        ) : (
          <button
            type="button"
            className="group relative grid h-full w-full place-items-center overflow-hidden text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-accent)] focus-visible:ring-offset-2"
            data-tiktok-poster
            onClick={() => {
              onPlay(video.videoId);
            }}
          >
            {thumbnailUrl ? (
              <Image
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                decoding="async"
                fill
                loading={index === 0 ? "eager" : "lazy"}
                referrerPolicy="no-referrer"
                sizes="(max-width: 640px) 244px, (max-width: 1024px) 292px, 320px"
                src={thumbnailUrl}
              />
            ) : (
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-[linear-gradient(145deg,color-mix(in_srgb,var(--site-primary)_86%,black),color-mix(in_srgb,var(--site-primary)_34%,white)_48%,color-mix(in_srgb,var(--site-accent)_42%,white))]"
              />
            )}
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
        )}
      </div>
    </article>
  );
}
