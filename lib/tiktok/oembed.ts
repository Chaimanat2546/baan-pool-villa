import "server-only";

import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import type {
  SiteTikTokSettings,
  SiteTikTokVideoSettings,
} from "@/lib/site-settings/types";
import type { TikTokPreviewSettings, TikTokVideoPreview } from "./types";

interface TikTokOEmbedResponse {
  author_name?: unknown;
  thumbnail_url?: unknown;
  title?: unknown;
}

const HOMEPAGE_TIKTOK_VIDEO_LIMIT = 6;
const TIKTOK_OEMBED_ENDPOINT = "https://www.tiktok.com/oembed";
const TIKTOK_OEMBED_TIMEOUT_MS = 3500;

function getVisibleVideos(videos: SiteTikTokSettings["videos"]) {
  const seen = new Set<string>();
  const visibleVideos: SiteTikTokSettings["videos"] = [];

  for (const video of videos) {
    const trimmedVideoId = video.videoId.trim();

    if (!trimmedVideoId || seen.has(trimmedVideoId)) {
      continue;
    }

    seen.add(trimmedVideoId);
    visibleVideos.push({
      url: video.url.trim(),
      videoId: trimmedVideoId,
    });

    if (visibleVideos.length === HOMEPAGE_TIKTOK_VIDEO_LIMIT) {
      break;
    }
  }

  return visibleVideos;
}

function isSafeImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function loadTikTokOEmbed(video: SiteTikTokVideoSettings) {
  const requestUrl = new URL(TIKTOK_OEMBED_ENDPOINT);
  requestUrl.searchParams.set("url", video.url);

  try {
    const response = await fetch(requestUrl, {
      next: {
        revalidate: CACHE_REVALIDATE_SECONDS.tiktokOEmbed,
        tags: [CACHE_TAGS.tiktokOEmbed, CACHE_TAGS.siteSettings],
      },
      signal: AbortSignal.timeout(TIKTOK_OEMBED_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as TikTokOEmbedResponse;
    const thumbnailUrl = isSafeImageUrl(payload.thumbnail_url)
      ? payload.thumbnail_url.trim()
      : "";

    if (!thumbnailUrl) {
      return null;
    }

    return {
      authorName: readString(payload.author_name),
      thumbnailUrl,
      title: readString(payload.title),
    };
  } catch {
    return null;
  }
}

export async function getTikTokPreviewSettings(
  tiktok: SiteTikTokSettings,
): Promise<TikTokPreviewSettings> {
  const videos = getVisibleVideos(tiktok.videos);
  const previews = await Promise.all(
    videos.map(async (video): Promise<TikTokVideoPreview> => {
      const metadata = await loadTikTokOEmbed(video);

      return {
        ...video,
        authorName: metadata?.authorName ?? "",
        thumbnailUrl: metadata?.thumbnailUrl ?? "",
        title: metadata?.title ?? "",
      };
    }),
  );

  return {
    accountUrl: tiktok.accountUrl.trim(),
    videos: previews,
  };
}
