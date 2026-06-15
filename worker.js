import openNextWorker, {
  BucketCachePurge,
  DOQueueHandler,
  DOShardedTagCache,
} from "./.open-next/worker.js";
import {
  createHtmlEdgeCacheKey,
  createHtmlEdgeVersionToken,
  createJsonEdgeCacheKey,
  getHtmlEdgeCacheDecision,
  getImageEdgeCacheDecision,
  getJsonEdgeCacheDecision,
  isNextStaticAssetPath,
  toHtmlEdgeCacheResponse,
  toImageEdgeCacheResponse,
  toJsonEdgeCacheResponse,
  withHtmlEdgeCacheHeader,
  withImageEdgeCacheHeader,
  withJsonEdgeCacheHeader,
  withStaticAssetCacheHeaders,
} from "./worker-cache-policy.js";
import { getHtmlEdgeCacheVersionToken } from "./worker-html-cache-version.js";

const IMAGE_CACHE_CONTROL =
  "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=31536000";

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
  const { pathname } = new URL(request.url);

  if (isNextStaticAssetPath(pathname)) {
    return withStaticAssetCacheHeaders(response);
  }

  if (isNextImageRequest(request)) {
    return withImageCacheHeaders(response);
  }

  return response;
}

function getWorkerDeploymentVersionToken(env) {
  const metadata = env?.CF_VERSION_METADATA;
  const id = typeof metadata?.id === "string" ? metadata.id.trim() : "";
  const tag = typeof metadata?.tag === "string" ? metadata.tag.trim() : "";

  return id || tag;
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
  const cmsVersionToken = await getHtmlEdgeCacheVersionToken(
    env,
    decision.versionGroups,
  );
  const versionToken = createHtmlEdgeVersionToken({
    cmsVersionToken,
    deploymentVersionToken: getWorkerDeploymentVersionToken(env),
  });
  const cacheKey = createHtmlEdgeCacheKey(request, versionToken);
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    return withHtmlEdgeCacheHeader(cachedResponse, "HIT");
  }

  const response = await fetchOpenNext(request, env, ctx);
  const cacheResponse = toHtmlEdgeCacheResponse(
    response,
    decision.cacheControl,
  );

  if (!cacheResponse) {
    return withHtmlEdgeCacheHeader(response, "BYPASS");
  }

  ctx.waitUntil(
    cache.put(cacheKey, cacheResponse.clone()).catch(() => undefined),
  );

  return withHtmlEdgeCacheHeader(cacheResponse, "MISS");
}

async function fetchWithImageEdgeCache(request, env, ctx) {
  const decision = getImageEdgeCacheDecision(request);

  if (!decision.candidate) {
    return fetchWithJsonEdgeCache(request, env, ctx);
  }

  if (!decision.cacheable) {
    const response = await fetchOpenNext(request, env, ctx);

    return withImageEdgeCacheHeader(response, "BYPASS");
  }

  const cache = caches.default;
  const cachedResponse = await cache.match(decision.cacheKey);

  if (cachedResponse) {
    return withImageEdgeCacheHeader(cachedResponse, "HIT");
  }

  const response = await fetchOpenNext(request, env, ctx);
  const cacheResponse = toImageEdgeCacheResponse(response);

  if (!cacheResponse) {
    return withImageEdgeCacheHeader(response, "BYPASS");
  }

  ctx.waitUntil(
    cache.put(decision.cacheKey, cacheResponse.clone()).catch(() => undefined),
  );

  return withImageEdgeCacheHeader(cacheResponse, "MISS");
}

async function fetchWithJsonEdgeCache(request, env, ctx) {
  const decision = getJsonEdgeCacheDecision(request);

  if (!decision.candidate) {
    return fetchWithHtmlEdgeCache(request, env, ctx);
  }

  if (!decision.cacheable) {
    const response = await fetchOpenNext(request, env, ctx);

    return withJsonEdgeCacheHeader(response, "BYPASS");
  }

  const cache = caches.default;
  const cmsVersionToken = await getHtmlEdgeCacheVersionToken(
    env,
    decision.versionGroups,
  );
  const versionToken = createHtmlEdgeVersionToken({
    cmsVersionToken,
    deploymentVersionToken: getWorkerDeploymentVersionToken(env),
  });
  const cacheKey = createJsonEdgeCacheKey(request, versionToken);
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    return withJsonEdgeCacheHeader(cachedResponse, "HIT");
  }

  const response = await fetchOpenNext(request, env, ctx);
  const cacheResponse = toJsonEdgeCacheResponse(
    response,
    decision.cacheControl,
  );

  if (!cacheResponse) {
    return withJsonEdgeCacheHeader(response, "BYPASS");
  }

  ctx.waitUntil(
    cache.put(cacheKey, cacheResponse.clone()).catch(() => undefined),
  );

  return withJsonEdgeCacheHeader(cacheResponse, "MISS");
}

export { BucketCachePurge, DOQueueHandler, DOShardedTagCache };

const worker = {
  async fetch(request, env, ctx) {
    return fetchWithImageEdgeCache(request, env, ctx);
  },
};

export default worker;
