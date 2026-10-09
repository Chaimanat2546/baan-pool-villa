import { CACHE_REVALIDATE_SECONDS } from "@/lib/cache-policy";

interface TikTokClientOEmbedPayload {
  author_name?: unknown;
  thumbnail_url?: unknown;
  title?: unknown;
}

export interface TikTokClientOEmbed {
  authorName: string;
  thumbnailUrl: string;
  title: string;
}

const TIKTOK_CLIENT_OEMBED_CACHE_PREFIX = "baan-pool-villa:tiktok-oembed:v2:";
const TIKTOK_CLIENT_OEMBED_CACHE_TTL_MS = CACHE_REVALIDATE_SECONDS.tiktokOEmbed * 1000;
const TIKTOK_CLIENT_OEMBED_REQUEST_INTERVAL_MS = 1_000;
const TIKTOK_CLIENT_OEMBED_RETRY_DELAY_MS = 2_000;
const TIKTOK_CLIENT_OEMBED_MAX_ATTEMPTS = 2;

interface CachedTikTokClientOEmbed extends TikTokClientOEmbed {
  expiresAt: number;
}

const memoryCache = new Map<string, CachedTikTokClientOEmbed>();
let queuedRequest: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readSafeImageUrl(value: unknown): string {
  const imageUrl = readString(value);

  if (!imageUrl) {
    return "";
  }

  try {
    const parsed = new URL(imageUrl);
    return parsed.protocol === "https:" ? imageUrl : "";
  } catch {
    return "";
  }
}

function buildTikTokOEmbedUrl(videoUrl: string): string {
  return `/api/tiktok/oembed?${new URLSearchParams({ url: videoUrl })}`;
}

function waitFor(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(resolve, ms);

    signal?.addEventListener("abort", () => {
      globalThis.clearTimeout(timeout);
      reject(signal.reason);
    }, { once: true });
  });
}

function queueTikTokOEmbedRequest<T>(
  callback: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const run = async () => {
    if (signal?.aborted) {
      throw signal.reason;
    }

    const requestedDelay = nextRequestAt - Date.now();
    const delay = requestedDelay > TIKTOK_CLIENT_OEMBED_REQUEST_INTERVAL_MS
      ? 0
      : Math.max(0, requestedDelay);
    await waitFor(delay, signal);
    nextRequestAt = Date.now() + TIKTOK_CLIENT_OEMBED_REQUEST_INTERVAL_MS;
    return callback();
  };
  const result = queuedRequest.then(run, run);
  queuedRequest = result.then(() => undefined, () => undefined);

  return result;
}

function getCacheKey(videoUrl: string): string {
  return `${TIKTOK_CLIENT_OEMBED_CACHE_PREFIX}${videoUrl}`;
}

function toFreshMetadata(
  cached: CachedTikTokClientOEmbed | null,
  now = Date.now(),
): TikTokClientOEmbed | null {
  if (!cached || !Number.isFinite(cached.expiresAt) || cached.expiresAt <= now || !readSafeImageUrl(cached.thumbnailUrl)) {
    return null;
  }

  return {
    authorName: readString(cached.authorName),
    thumbnailUrl: cached.thumbnailUrl,
    title: readString(cached.title),
  };
}

function readLocalStorageCache(videoUrl: string): CachedTikTokClientOEmbed | null {
  try {
    const cachedValue = globalThis.localStorage?.getItem(getCacheKey(videoUrl));

    if (!cachedValue) {
      return null;
    }

    const cached = JSON.parse(cachedValue) as CachedTikTokClientOEmbed | null;
    const metadata = toFreshMetadata(cached);

    if (!metadata) {
      globalThis.localStorage?.removeItem(getCacheKey(videoUrl));
    }

    return metadata && cached ? { ...metadata, expiresAt: cached.expiresAt } : null;
  } catch {
    return null;
  }
}
function writeCaches(videoUrl: string, metadata: TikTokClientOEmbed): void {
  const cached: CachedTikTokClientOEmbed = {
    ...metadata,
    expiresAt: Date.now() + TIKTOK_CLIENT_OEMBED_CACHE_TTL_MS,
  };

  memoryCache.set(videoUrl, cached);

  try {
    globalThis.localStorage?.setItem(getCacheKey(videoUrl), JSON.stringify(cached));
  } catch {
    // Storage can be unavailable in private mode; the in-memory cache still helps.
  }
}

export async function loadTikTokClientOEmbed(
  videoUrl: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<TikTokClientOEmbed | null> {
  const trimmedVideoUrl = videoUrl.trim();
  const memoryMetadata = toFreshMetadata(memoryCache.get(trimmedVideoUrl) ?? null);

  if (memoryMetadata) {
    return memoryMetadata;
  }

  const storageMetadata = readLocalStorageCache(trimmedVideoUrl);

  if (storageMetadata) {
    memoryCache.set(trimmedVideoUrl, storageMetadata);
    return toFreshMetadata(storageMetadata);
  }

  try {
    let response: Response | null = null;

    for (let attempt = 1; attempt <= TIKTOK_CLIENT_OEMBED_MAX_ATTEMPTS; attempt += 1) {
      response = await queueTikTokOEmbedRequest(
        () => fetcher(buildTikTokOEmbedUrl(trimmedVideoUrl), {
          cache: "default",
          signal,
        }),
        signal,
      );

      if (response.status !== 429 || attempt === TIKTOK_CLIENT_OEMBED_MAX_ATTEMPTS) {
        break;
      }

      await waitFor(TIKTOK_CLIENT_OEMBED_RETRY_DELAY_MS, signal);
    }

    if (!response?.ok) {
      return null;
    }

    const payload = (await response.json()) as TikTokClientOEmbedPayload | null;
    if (!payload) {
      return null;
    }
    const thumbnailUrl = readSafeImageUrl(payload.thumbnail_url);

    if (!thumbnailUrl) {
      return null;
    }

    const metadata = {
      authorName: readString(payload.author_name),
      thumbnailUrl,
      title: readString(payload.title),
    };

    writeCaches(trimmedVideoUrl, metadata);
    return metadata;
  } catch {
    return null;
  }
}
