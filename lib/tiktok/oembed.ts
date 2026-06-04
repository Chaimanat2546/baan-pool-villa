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

/**
 * Selects a deduplicated, trimmed subset of TikTok videos for homepage use.
 *
 * Trims `videoId` and `url`, omits entries with an empty `videoId`, and removes duplicates by `videoId`.
 *
 * @param videos - The input array of TikTok video settings to filter.
 * @returns An array of video entries with trimmed `url` and `videoId`, limited to the homepage video cap.
 */
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

/**
 * Determines whether a value is a non-empty string that represents an HTTPS URL.
 *
 * @param value - The value to check
 * @returns `true` if `value` is a non-empty string that parses as a URL with the `https:` protocol, `false` otherwise.
 */
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

/**
 * Normalize a value to a trimmed string.
 *
 * @param value - The input to convert; if not a string it is treated as missing.
 * @returns The trimmed string when `value` is a string, otherwise an empty string.
 */
function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Fetches TikTok oEmbed metadata for a given video and returns canonicalized preview fields.
 *
 * @param video - Site TikTok video settings containing the `url` to query
 * @returns An object with `authorName`, `thumbnailUrl`, and `title` (all trimmed strings) or `null` if the request fails, the response is invalid, or the `thumbnail_url` is missing or not an `https:` URL.
 */
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

/**
 * Builds preview settings for a site's TikTok configuration by enriching the visible videos with oEmbed metadata.
 *
 * @param tiktok - Site TikTok configuration (expects `accountUrl` and `videos`).
 * @returns A `TikTokPreviewSettings` object containing the trimmed account URL and an array of video previews. Each preview includes `authorName`, `thumbnailUrl`, and `title`; any missing metadata fields are an empty string.
 */
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
