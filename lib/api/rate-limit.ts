import "server-only";

export type PublicRateLimitPolicy =
  | "publicCatalog"
  | "publicDetail"
  | "publicDownload";

interface PublicRateLimitPolicyConfig {
  limit: number;
  windowMs: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const ONE_MINUTE_MS = 60_000;
const MAX_RATE_LIMIT_BUCKETS = 1_000;
const TOO_MANY_REQUESTS_MESSAGE = "Too many requests.";

export const PUBLIC_RATE_LIMIT_POLICIES = {
  publicCatalog: {
    limit: 120,
    windowMs: ONE_MINUTE_MS,
  },
  publicDetail: {
    limit: 90,
    windowMs: ONE_MINUTE_MS,
  },
  publicDownload: {
    limit: 20,
    windowMs: ONE_MINUTE_MS,
  },
} satisfies Record<PublicRateLimitPolicy, PublicRateLimitPolicyConfig>;

const buckets = new Map<string, RateLimitBucket>();

function readTrimmedHeader(headers: Headers, headerName: string): string | null {
  const value = headers.get(headerName)?.trim();

  return value ? value : null;
}

/**
 * Resolves the client key used for public API rate limiting.
 *
 * @param request - The incoming public API request.
 * @returns The client identifier used for rate-limit buckets.
 */
export function getPublicRateLimitClientKey(request: Request): string {
  return readTrimmedHeader(request.headers, "CF-Connecting-IP") ?? "unknown";
}

function getBucketKey(policy: PublicRateLimitPolicy, clientKey: string): string {
  return `${policy}:${clientKey}`;
}

function pruneExpiredBuckets(now: number) {
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  });

  while (buckets.size > MAX_RATE_LIMIT_BUCKETS) {
    const oldestKey = buckets.keys().next().value;

    if (typeof oldestKey !== "string") {
      return;
    }

    buckets.delete(oldestKey);
  }
}

function createTooManyRequestsResponse(retryAfterSeconds: number): Response {
  return Response.json(
    {
      error: TOO_MANY_REQUESTS_MESSAGE,
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

/**
 * Applies the configured public API rate limit policy to a request.
 *
 * @param request - The incoming public API request.
 * @param policy - The rate-limit policy to enforce.
 * @returns A `429` response when the request is rate-limited, or `null` when allowed.
 */
export function limitPublicApiRequest(
  request: Request,
  policy: PublicRateLimitPolicy,
): Response | null {
  const config = PUBLIC_RATE_LIMIT_POLICIES[policy];
  const now = Date.now();
  const clientKey = getPublicRateLimitClientKey(request);
  const bucketKey = getBucketKey(policy, clientKey);

  pruneExpiredBuckets(now);

  const existingBucket = buckets.get(bucketKey);
  const bucket =
    existingBucket && existingBucket.resetAt > now
      ? existingBucket
      : {
          count: 0,
          resetAt: now + config.windowMs,
        };

  buckets.set(bucketKey, bucket);

  if (bucket.count >= config.limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.resetAt - now) / 1000),
    );

    return createTooManyRequestsResponse(retryAfterSeconds);
  }

  bucket.count += 1;

  return null;
}

/**
 * Clears in-memory public API rate-limit buckets for test isolation.
 *
 * @returns `void`.
 */
export function resetPublicRateLimitForTests() {
  buckets.clear();
}
