import openNextWorker, {
  BucketCachePurge,
  DOQueueHandler,
  DOShardedTagCache,
} from "./.open-next/worker.js";

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

export { BucketCachePurge, DOQueueHandler, DOShardedTagCache };

const worker = {
  async fetch(request, env, ctx) {
    const response = await openNextWorker.fetch(request, env, ctx);

    if (isNextImageRequest(request)) {
      return withImageCacheHeaders(response);
    }

    return response;
  },
};

export default worker;
