"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

interface YouTubeLiteEmbedProps {
  title: string;
  videoId: string;
}

function getThumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function getPlayerUrl(videoId: string) {
  const url = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
  url.searchParams.set("autoplay", "1");
  url.searchParams.set("rel", "0");
  return url.href;
}

export function YouTubeLiteEmbed({ title, videoId }: YouTubeLiteEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-[0_14px_30px_rgba(6,63,53,0.08)]">
      {isPlaying ? (
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="aspect-video w-full"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          src={getPlayerUrl(videoId)}
          title={title}
        />
      ) : (
        <button
          aria-label={`เล่นวิดีโอ ${title}`}
          className="group relative grid aspect-video w-full cursor-pointer place-items-center overflow-hidden bg-[var(--site-primary-hover)] text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-accent)] focus-visible:ring-offset-2"
          onClick={() => {
            setIsPlaying(true);
          }}
          type="button"
        >
          <Image
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
            height={360}
            sizes="(max-width: 768px) 100vw, 768px"
            src={getThumbnailUrl(videoId)}
            width={640}
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,15,40,0.04),rgba(5,15,40,0.68))]"
          />
          <span className="relative grid h-16 w-16 place-items-center rounded-full bg-white/92 text-[var(--site-primary)] shadow-[0_18px_42px_rgba(0,0,0,0.24)] transition group-hover:scale-105">
            <Play aria-hidden="true" className="ml-1 size-7 fill-current" />
          </span>
        </button>
      )}
    </div>
  );
}
