import openNextWorker, {
  BucketCachePurge,
  DOQueueHandler,
  DOShardedTagCache,
} from "./.open-next/worker.js";
import {
  getHtmlEdgeCacheDecision,
  toHtmlEdgeCacheResponse,
  withHtmlEdgeCacheHeader,
} from "./worker-cache-policy.js";

const IMAGE_CACHE_CONTROL =
  "public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400";

function isNextImageRequest(request) {
  const { pathname } = new URL(request.url);
  return pathname === "/_next/image" || pathname === "/_next/image/";
}

function withImageCacheHeaders(response) {
  if (!response.ok) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", IMAGE_CACHE_CONTROL);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

async function fetchOpenNext(request, env, ctx) {
  const response = await openNextWorker.fetch(request, env, ctx);

  if (isNextImageRequest(request)) {
    return withImageCacheHeaders(response);
  }

  return response;
}

async function fetchWithHtmlEdgeCache(request, env, ctx) {
  const decision = getHtmlEdgeCacheDecision(request);

  if (!decision.cacheable) {
    const response = await fetchOpenNext(request, env, ctx);

    return decision.candidate
      ? withHtmlEdgeCacheHeader(response, "BYPASS")
      : response;
  }

  const cache = caches.default;
  const cachedResponse = await cache.match(decision.cacheKey);

  if (cachedResponse) {
    return withHtmlEdgeCacheHeader(cachedResponse, "HIT");
  }

  const response = await fetchOpenNext(request, env, ctx);
  const cacheResponse = toHtmlEdgeCacheResponse(response);

  if (!cacheResponse) {
    return withHtmlEdgeCacheHeader(response, "BYPASS");
  }

  ctx.waitUntil(
    cache.put(decision.cacheKey, cacheResponse.clone()).catch(() => undefined),
  );

  return withHtmlEdgeCacheHeader(cacheResponse, "MISS");
}

export { BucketCachePurge, DOQueueHandler, DOShardedTagCache };

const worker = {
  async fetch(request, env, ctx) {
    return fetchWithHtmlEdgeCache(request, env, ctx);
  },
};

export default worker;
