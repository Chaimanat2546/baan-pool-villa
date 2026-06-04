"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { SiTiktok } from "react-icons/si";

import type { SiteTikTokVideoSettings } from "@/lib/site-settings/types";
import type { TikTokVideoPreview } from "@/lib/tiktok/types";

interface TikTokLazyCardProps {
  index: number;
  video: SiteTikTokVideoSettings | TikTokVideoPreview;
}

function getPlayerSrc(videoId: string) {
  const params = new URLSearchParams({
    autoplay: "1",
    controls: "1",
    rel: "0",
  });

  return `https://www.tiktok.com/player/v1/${videoId}?${params.toString()}`;
}

function hasThumbnail(
  video: SiteTikTokVideoSettings | TikTokVideoPreview,
): video is TikTokVideoPreview {
  return "thumbnailUrl" in video && video.thumbnailUrl.trim().length > 0;
}

function TikTokPlayer({ index, video }: TikTokLazyCardProps) {
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

export function TikTokLazyCard({ index, video }: TikTokLazyCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const title =
    "title" in video && video.title.trim().length > 0
      ? video.title.trim()
      : `video/${video.videoId}`;
  const authorName =
    "authorName" in video && video.authorName.trim().length > 0
      ? video.authorName.trim()
      : "TikTok";

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
              setIsPlaying(true);
            }}
          >
            {hasThumbnail(video) ? (
              <Image
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                decoding="async"
                fill
                loading={index === 0 ? "eager" : "lazy"}
                referrerPolicy="no-referrer"
                sizes="(max-width: 640px) 244px, (max-width: 1024px) 292px, 320px"
                src={video.thumbnailUrl}
                unoptimized
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
