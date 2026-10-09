import "server-only";

import { unstable_cache } from "next/cache";

import { CACHE_HEADERS, CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { isAllowedTikTokCdnImageUrl } from "@/lib/public-image-proxy";
import { isValidTikTokVideoUrl } from "@/lib/site-settings/validation";

const MAX_VIDEO_URL_LENGTH = 2048;
const OEMBED_TIMEOUT_MS = 6000;
const OEMBED_RETRY_AFTER_SECONDS = 1;

class TikTokOEmbedRateLimitError extends Error {
  constructor() {
    super("TikTok metadata is temporarily unavailable.");
  }
}

function readVideoUrl(request: Request): string | null {
  const entries = [...new URL(request.url).searchParams.entries()];
  const [name, value] = entries[0] ?? [];
  if (entries.length !== 1 || name !== "url" || !value || value.length > MAX_VIDEO_URL_LENGTH) {
    return null;
  }

  if (!isValidTikTokVideoUrl(value)) {
    return null;
  }

  const url = new URL(value);
  if (url.username || url.password || url.port) {
    return null;
  }

  url.hostname = "www.tiktok.com";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function fetchTikTokOEmbed(videoUrl: string) {
  const endpoint = new URL("https://www.tiktok.com/oembed");
  endpoint.searchParams.set("url", videoUrl);
  const response = await fetch(endpoint.toString(), {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(OEMBED_TIMEOUT_MS),
  });

  if (response.status === 429) {
    throw new TikTokOEmbedRateLimitError();
  }

  if (!response.ok) {
    throw new Error("TikTok metadata unavailable.");
  }

  const payload: unknown = await response.json();
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const data = payload as { thumbnail_url?: unknown; author_name?: unknown; title?: unknown };
    const thumbnailUrl = readText(data.thumbnail_url);
    if (isAllowedTikTokCdnImageUrl(thumbnailUrl)) {
      return {
        author_name: readText(data.author_name),
        thumbnail_url: thumbnailUrl,
        title: readText(data.title),
      };
    }
  }

  // Throw inside the cache scope so transient invalid responses are never stored.
  throw new Error("Invalid TikTok metadata.");
}

const getCachedTikTokOEmbed = unstable_cache(fetchTikTokOEmbed, ["tiktok-oembed-v1"], {
  revalidate: CACHE_REVALIDATE_SECONDS.tiktokOEmbed,
  tags: [CACHE_TAGS.tiktokOEmbed],
});

export async function buildTikTokOEmbedResponse(request: Request): Promise<Response> {
  const videoUrl = readVideoUrl(request);
  if (!videoUrl) {
    return Response.json({ error: "Invalid TikTok video URL." }, {
      status: 400, headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    return Response.json(await getCachedTikTokOEmbed(videoUrl), {
      headers: { "Cache-Control": CACHE_HEADERS.tiktokOEmbed },
    });
  } catch (error) {
    if (error instanceof TikTokOEmbedRateLimitError) {
      return Response.json({ error: error.message }, {
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": OEMBED_RETRY_AFTER_SECONDS.toString(),
        },
        status: 429,
      });
    }

    // The existing poster/title fallback also covers unavailable upstream metadata.
  }

  return Response.json(null, { headers: { "Cache-Control": "no-store" } });
}
