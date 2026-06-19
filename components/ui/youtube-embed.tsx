"use client";

import Image from "next/image";
import { useState } from "react";
import { FaYoutube } from "react-icons/fa";

interface YouTubeEmbedProps {
  className?: string;
  embedUrl?: string;
  title: string;
  videoId?: string;
}

const YOUTUBE_EMBED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

function getBaseEmbedUrl({ embedUrl, videoId }: Pick<YouTubeEmbedProps, "embedUrl" | "videoId">) {
  if (embedUrl) {
    try {
      const url = new URL(embedUrl);
      if (url.protocol === "https:" && YOUTUBE_EMBED_HOSTS.has(url.hostname)) {
        return url.href;
      }
    } catch {
      // Fall back to the stored video id below.
    }
  }

  if (!videoId) {
    return null;
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

function getPlayerUrl(baseEmbedUrl: string) {
  const url = new URL(baseEmbedUrl);
  url.searchParams.set("autoplay", "1");
  url.searchParams.set("controls", "0");
  url.searchParams.set("disablekb", "1");
  url.searchParams.set("fs", "0");
  url.searchParams.set("iv_load_policy", "3");
  url.searchParams.set("modestbranding", "1");
  url.searchParams.set("playsinline", "1");
  url.searchParams.set("rel", "0");
  return url.href;
}

function getVideoId({ embedUrl, videoId }: Pick<YouTubeEmbedProps, "embedUrl" | "videoId">) {
  if (videoId) {
    return videoId;
  }

  if (!embedUrl) {
    return null;
  }

  try {
    const url = new URL(embedUrl);
    const [prefix, id] = url.pathname.split("/").filter(Boolean);
    return prefix === "embed" ? (id ?? null) : null;
  } catch {
    return null;
  }
}

function getThumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function YouTubeEmbed({ className, embedUrl, title, videoId }: YouTubeEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const baseEmbedUrl = getBaseEmbedUrl({ embedUrl, videoId });

  if (!baseEmbedUrl) {
    return null;
  }

  const posterVideoId = getVideoId({ embedUrl: baseEmbedUrl, videoId });
  const baseClassName =
    "overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-[0_14px_30px_rgba(6,63,53,0.08)]";

  return (
    <div className={className ? `${baseClassName} ${className}` : baseClassName}>
      <div className="relative aspect-video w-full bg-[var(--site-primary-hover)]">
        {isPlaying ? (
          <>
            <iframe
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              className="absolute inset-0 h-full w-full"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-presentation allow-same-origin allow-scripts"
              src={getPlayerUrl(baseEmbedUrl)}
              title={title}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              data-youtube-click-guard
            >
              <span className="pointer-events-auto absolute inset-x-0 top-0 h-[36%]" />
              <span className="pointer-events-auto absolute inset-x-0 bottom-0 h-[36%]" />
              <span className="pointer-events-auto absolute bottom-[36%] left-0 top-[36%] w-[36%]" />
              <span className="pointer-events-auto absolute bottom-[36%] right-0 top-[36%] w-[36%]" />
            </div>
          </>
        ) : (
          <button
            aria-label={`เล่นวิดีโอ ${title}`}
            className="group absolute inset-0 grid place-items-center overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-accent)] focus-visible:ring-offset-2"
            data-youtube-play-button
            onClick={() => {
              setIsPlaying(true);
            }}
            type="button"
          >
            {posterVideoId ? (
              <Image
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                height={360}
                sizes="(max-width: 768px) 100vw, 768px"
                src={getThumbnailUrl(posterVideoId)}
                width={640}
              />
            ) : null}
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,15,40,0.08),rgba(5,15,40,0.46))]"
            />
            <FaYoutube
              aria-hidden="true"
              className="relative size-16 text-red-600 drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)] transition group-hover:scale-105"
            />
          </button>
        )}
      </div>
    </div>
  );
}
