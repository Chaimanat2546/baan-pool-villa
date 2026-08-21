import openNextWorker, {
  BucketCachePurge,
  DOQueueHandler,
  DOShardedTagCache,
} from "./.open-next/worker.js";
import { WorkerEntrypoint } from "cloudflare:workers";
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
import { handleBookingCalendarAccess } from "./worker-calendar-access.js";
import {
  blockPublicCentralUserManagerRequest,
} from "./worker-central-user-manager.js";
import { getHtmlEdgeCacheVersionToken } from "./worker-html-cache-version.js";
import {
  runCacheRead,
  scheduleCacheWrite,
} from "./worker-cache-resilience.js";

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
  const versionResult = await runCacheRead({
    cacheKind: "html",
    operation: "version",
    routeKind: "html",
    run: () => getHtmlEdgeCacheVersionToken(env, decision.versionGroups),
  });

  if (!versionResult.ok) {
    return withHtmlEdgeCacheHeader(
      await fetchOpenNext(request, env, ctx),
      "BYPASS",
    );
  }

  const versionToken = createHtmlEdgeVersionToken({
    cmsVersionToken: versionResult.value,
    deploymentVersionToken: getWorkerDeploymentVersionToken(env),
  });
  const cacheKey = createHtmlEdgeCacheKey(request, versionToken);
  const cacheResult = await runCacheRead({
    cacheKind: "html",
    operation: "match",
    routeKind: "html",
    run: () => cache.match(cacheKey),
  });

  if (!cacheResult.ok) {
    return withHtmlEdgeCacheHeader(
      await fetchOpenNext(request, env, ctx),
      "BYPASS",
    );
  }

  const cachedResponse = cacheResult.value;

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

  const cacheWriteResponse = cacheResponse.clone();

  scheduleCacheWrite(ctx, {
    cacheKind: "html",
    operation: "put",
    routeKind: "html",
    run: () => cache.put(cacheKey, cacheWriteResponse),
  });

  return withHtmlEdgeCacheHeader(cacheResponse, "MISS");
}

async function fetchWithImageEdgeCacheInternal(request, env, ctx) {
  const decision = getImageEdgeCacheDecision(request);

  if (!decision.candidate) {
    return fetchWithJsonEdgeCache(request, env, ctx);
  }

  if (!decision.cacheable) {
    const response = await fetchOpenNext(request, env, ctx);

    return withImageEdgeCacheHeader(response, "BYPASS");
  }

  const cache = caches.default;
  let cacheKey = decision.cacheKey;

  if (decision.versionGroups) {
    const versionResult = await runCacheRead({
      cacheKind: "image",
      operation: "version",
      routeKind: "image",
      run: () => getHtmlEdgeCacheVersionToken(env, decision.versionGroups),
    });

    if (!versionResult.ok) {
      return withImageEdgeCacheHeader(
        await fetchOpenNext(request, env, ctx),
        "BYPASS",
      );
    }

    const versionToken = createHtmlEdgeVersionToken({
      cmsVersionToken: versionResult.value,
      deploymentVersionToken: getWorkerDeploymentVersionToken(env),
    });
    cacheKey = createImageEdgeCacheKey(request, versionToken);
  }

  const cacheResult = await runCacheRead({
    cacheKind: "image",
    operation: "match",
    routeKind: "image",
    run: () => cache.match(cacheKey),
  });

  if (!cacheResult.ok) {
    return withImageEdgeCacheHeader(
      await fetchOpenNext(request, env, ctx),
      "BYPASS",
    );
  }

  const cachedResponse = cacheResult.value;

  if (cachedResponse) {
    return withImageEdgeCacheHeader(cachedResponse, "HIT");
  }

  const response = await fetchOpenNext(request, env, ctx);
  const cacheResponse = toImageEdgeCacheResponse(response);

  if (!cacheResponse) {
    return withImageEdgeCacheHeader(response, "BYPASS");
  }

  const cacheWriteResponse = cacheResponse.clone();

  scheduleCacheWrite(ctx, {
    cacheKind: "image",
    operation: "put",
    routeKind: "image",
    run: () => cache.put(cacheKey, cacheWriteResponse),
  });

  return withImageEdgeCacheHeader(cacheResponse, "MISS");
}

async function fetchWithImageEdgeCache(request, env, ctx) {
  try {
    return await fetchWithImageEdgeCacheInternal(request, env, ctx);
  } catch {
    return withImageEdgeCacheHeader(
      await fetchOpenNext(request, env, ctx),
      "BYPASS",
    );
  }
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
  const versionResult = await runCacheRead({
    cacheKind: "json",
    operation: "version",
    routeKind: "api",
    run: () => getHtmlEdgeCacheVersionToken(env, decision.versionGroups),
  });

  if (!versionResult.ok) {
    return withJsonEdgeCacheHeader(
      await fetchOpenNext(request, env, ctx),
      "BYPASS",
    );
  }

  const versionToken = createHtmlEdgeVersionToken({
    cmsVersionToken: versionResult.value,
    deploymentVersionToken: getWorkerDeploymentVersionToken(env),
  });
  const cacheKey = createJsonEdgeCacheKey(request, versionToken);
  const cacheResult = await runCacheRead({
    cacheKind: "json",
    operation: "match",
    routeKind: "api",
    run: () => cache.match(cacheKey),
  });

  if (!cacheResult.ok) {
    return withJsonEdgeCacheHeader(
      await fetchOpenNext(request, env, ctx),
      "BYPASS",
    );
  }

  const cachedResponse = cacheResult.value;

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

  const cacheWriteResponse = cacheResponse.clone();

  scheduleCacheWrite(ctx, {
    cacheKind: "json",
    operation: "put",
    routeKind: "api",
    run: () => cache.put(cacheKey, cacheWriteResponse),
  });

  return withJsonEdgeCacheHeader(cacheResponse, "MISS");
}

export { BucketCachePurge, DOQueueHandler, DOShardedTagCache };

export class CentralUserManagerEntrypoint extends WorkerEntrypoint {
  async executeOperation(input) {
    try {
      const response = await openNextWorker.fetch(
        new Request(
          "https://worker.internal/api/_worker/central-user-manager",
          {
            body: JSON.stringify(input),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          },
        ),
        this.env,
        this.ctx,
      );

      return await response.json();
    } catch {
      return {
        ok: false,
        error: {
          code: "agent_unavailable",
          message: "User management is unavailable.",
        },
      };
    }
  }
}

const worker = {
  async fetch(request, env, ctx) {
    const centralUserManagerResponse =
      blockPublicCentralUserManagerRequest(request);

    if (centralUserManagerResponse) {
      return centralUserManagerResponse;
    }

    // Calendar host, Bearer, and rate-limit checks must run before OpenNext
    // and every cache lookup. Calendar responses are never shared Edge JSON.
    const calendarAccessResponse = await handleBookingCalendarAccess(
      request,
      env,
    );

    if (calendarAccessResponse) {
      return calendarAccessResponse;
    }

    return fetchWithImageEdgeCache(request, env, ctx);
  },
};

export default worker;
