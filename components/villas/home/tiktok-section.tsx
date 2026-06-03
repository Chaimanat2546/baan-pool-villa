import { SiTiktok } from "react-icons/si";

import type { SiteTikTokSettings } from "@/lib/site-settings/types";

interface TikTokSectionProps {
  tiktok: SiteTikTokSettings;
}

function getVisibleVideos(videos: SiteTikTokSettings["videos"]) {
  const seen = new Set<string>();
  const visibleVideos: SiteTikTokSettings["videos"] = [];

  for (const video of videos) {
    const trimmedVideoId = video.videoId.trim();

    if (!trimmedVideoId || seen.has(trimmedVideoId)) {
      continue;
    }

    seen.add(trimmedVideoId);
    visibleVideos.push({ ...video, videoId: trimmedVideoId });

    if (visibleVideos.length === 3) {
      break;
    }
  }

  return visibleVideos;
}

function renderVideoFrame(videoId: string, index: number, loading: "eager" | "lazy") {
  return (
    <iframe
      allow="fullscreen"
      className="h-full w-full border-0"
      loading={loading}
      src={`https://www.tiktok.com/player/v1/${videoId}?controls=1&rel=0`}
      title={`TikTok video ${index + 1}`}
    />
  );
}

function TikTokCard({ videoId, index }: { index: number; videoId: string }) {
  return (
    <article
      className="w-[292px] flex-shrink-0 overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-[0_12px_30px_rgba(15,47,53,0.08)] lg:w-full"
    >
      <div className="relative aspect-[9/16] bg-[var(--site-surface-soft)]">
        {renderVideoFrame(videoId, index, index === 0 ? "eager" : "lazy")}
      </div>
    </article>
  );
}

export function TikTokSection({ tiktok }: TikTokSectionProps) {
  const videos = getVisibleVideos(tiktok.videos);
  const accountUrl = tiktok.accountUrl.trim();

  if (videos.length === 0) {
    return null;
  }

  return (
    <section
      className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
      data-home-tiktok
    >
      <div className="text-center">
        <h2 className="text-3xl font-black text-[var(--site-text)] md:text-4xl">
          TikTok
        </h2>
      </div>

      <div className="mt-8 flex gap-4 overflow-x-auto pb-2 pl-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:pb-0">
        {videos.map((video, index) => (
          <TikTokCard index={index} videoId={video.videoId} key={video.videoId} />
        ))}
      </div>

      {accountUrl ? (
        <div className="mt-8 flex justify-center">
          <a
            className="inline-flex items-center gap-2 rounded-full border border-[var(--site-primary)] px-5 py-3 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary)] hover:text-[var(--site-on-primary)]"
            href={accountUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <SiTiktok aria-hidden="true" className="size-5" />
            Follow us on TikTok
          </a>
        </div>
      ) : null}
    </section>
  );
}
