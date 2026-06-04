import { SiTiktok } from "react-icons/si";

import type { SiteTikTokSettings } from "@/lib/site-settings/types";
import type { TikTokPreviewSettings } from "@/lib/tiktok/types";
import { ScrollRail } from "./scroll-rail";
import { TikTokLazyCard } from "./tiktok-lazy-card";

interface TikTokSectionProps {
  tiktok: SiteTikTokSettings | TikTokPreviewSettings;
}

const HOMEPAGE_TIKTOK_VIDEO_LIMIT = 6;
type TikTokSectionVideo = SiteTikTokSettings["videos"][number] | TikTokPreviewSettings["videos"][number];

function getVisibleVideos(tiktok: TikTokSectionProps["tiktok"]) {
  const seen = new Set<string>();
  const visibleVideos: TikTokSectionVideo[] = [];

  for (const video of tiktok.videos) {
    const trimmedVideoId = video.videoId.trim();

    if (!trimmedVideoId || seen.has(trimmedVideoId)) {
      continue;
    }

    seen.add(trimmedVideoId);
    visibleVideos.push({ ...video, videoId: trimmedVideoId });

    if (visibleVideos.length === HOMEPAGE_TIKTOK_VIDEO_LIMIT) {
      break;
    }
  }

  return visibleVideos;
}

export function TikTokSection({ tiktok }: TikTokSectionProps) {
  const videos = getVisibleVideos(tiktok);
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

      <ScrollRail
        alwaysShowControls
        className="-mx-4 mt-8 gap-4 px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:gap-6 lg:px-8"
        controlsClassName="mt-5"
        label="วิดีโอ TikTok"
      >
        {videos.map((video, index) => (
          <TikTokLazyCard index={index} video={video} key={video.videoId} />
        ))}
      </ScrollRail>

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
