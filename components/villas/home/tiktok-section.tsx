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

/**
 * Selects up to six unique TikTok videos with trimmed `videoId`s from the provided settings.
 *
 * Iterates `tiktok.videos` in order and returns a list that preserves that order, omitting entries whose
 * `videoId` is empty after trimming or duplicates by `videoId`.
 *
 * @param tiktok - Settings object containing a `videos` array to select from
 * @returns An array of videos with `videoId` trimmed, preserving original order, containing at most `HOMEPAGE_TIKTOK_VIDEO_LIMIT` entries; entries with empty or duplicate `videoId`s are excluded
 */
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

/**
 * Render a homepage TikTok section with a horizontally scrollable rail of videos and an optional follow link.
 *
 * Renders nothing if there are no valid videos to display.
 *
 * @param tiktok - TikTok settings (site or preview) that provide `videos` and an `accountUrl`; video IDs are trimmed, deduplicated, and limited before rendering.
 * @returns A section element containing the TikTok header, a scrollable list of TikTok cards, and an optional "Follow us on TikTok" link, or `null` when no videos are available.
 */
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
            ติดตามพวกเราบน TikTok
          </a>
        </div>
      ) : null}
    </section>
  );
}
