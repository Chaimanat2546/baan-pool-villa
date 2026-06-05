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

const TIKTOK_OEMBED_ENDPOINT = "https://www.tiktok.com/oembed";
const TIKTOK_CLIENT_OEMBED_CACHE_PREFIX = "baan-pool-villa:tiktok-oembed:";
const TIKTOK_CLIENT_OEMBED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedTikTokClientOEmbed extends TikTokClientOEmbed {
  expiresAt: number;
}

const memoryCache = new Map<string, CachedTikTokClientOEmbed>();

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
  const requestUrl = new URL(TIKTOK_OEMBED_ENDPOINT);
  requestUrl.searchParams.set("url", videoUrl);

  return requestUrl.toString();
}

function getCacheKey(videoUrl: string): string {
  return `${TIKTOK_CLIENT_OEMBED_CACHE_PREFIX}${videoUrl}`;
}

function toFreshMetadata(
  cached: CachedTikTokClientOEmbed | null,
  now = Date.now(),
): TikTokClientOEmbed | null {
  if (!cached || cached.expiresAt <= now || !readSafeImageUrl(cached.thumbnailUrl)) {
    return null;
  }

  return {
    authorName: readString(cached.authorName),
    thumbnailUrl: cached.thumbnailUrl,
    title: readString(cached.title),
  };
}

function readLocalStorageCache(videoUrl: string): TikTokClientOEmbed | null {
  try {
    const cachedValue = globalThis.localStorage?.getItem(getCacheKey(videoUrl));

    if (!cachedValue) {
      return null;
    }

    const metadata = toFreshMetadata(JSON.parse(cachedValue) as CachedTikTokClientOEmbed | null);

    if (!metadata) {
      globalThis.localStorage?.removeItem(getCacheKey(videoUrl));
    }

    return metadata;
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
    memoryCache.set(trimmedVideoUrl, {
      ...storageMetadata,
      expiresAt: Date.now() + TIKTOK_CLIENT_OEMBED_CACHE_TTL_MS,
    });
    return storageMetadata;
  }

  try {
    const response = await fetcher(buildTikTokOEmbedUrl(trimmedVideoUrl), {
      cache: "force-cache",
      signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as TikTokClientOEmbedPayload;
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
