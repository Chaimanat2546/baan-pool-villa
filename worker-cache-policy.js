const HTML_EDGE_CACHE_SECONDS = 300;

export const HTML_EDGE_CACHE_CONTROL = `public, max-age=0, s-maxage=${HTML_EDGE_CACHE_SECONDS}`;
export const HTML_EDGE_CACHE_HEADER = "x-bpv-html-cache";

const PUBLIC_HTML_CACHE_PATHS = new Set([
  "/",
  "/search",
  "/guides",
  "/terms",
  "/privacy",
]);

const RSC_VARIANT_HEADERS = [
  "rsc",
  "next-router-prefetch",
  "next-router-state-tree",
  "next-router-segment-prefetch",
  "next-url",
];

function hasHeader(request, headerName) {
  return request.headers.get(headerName) !== null;
}

function acceptsHtml(request) {
  const accept = request.headers.get("Accept")?.toLowerCase().trim();

  return !accept || accept.includes("text/html") || accept.includes("*/*");
}

function isGuideDetailPath(pathname) {
  if (!pathname.startsWith("/guides/")) {
    return false;
  }

  const slug = pathname.slice("/guides/".length);

  return slug.length > 0 && !slug.includes("/");
}

export function isPublicHtmlCachePath(pathname) {
  return PUBLIC_HTML_CACHE_PATHS.has(pathname) || isGuideDetailPath(pathname);
}

export function createHtmlEdgeCacheKey(request) {
  const url = new URL(request.url);
  url.search = "";
  url.hash = "";

  return new Request(url.toString(), { method: "GET" });
}

export function getHtmlEdgeCacheDecision(request) {
  const url = new URL(request.url);
  const isCandidatePath = isPublicHtmlCachePath(url.pathname);

  if (!isCandidatePath) {
    return { cacheable: false, candidate: false, reason: "path" };
  }

  if (request.method !== "GET") {
    return { cacheable: false, candidate: true, reason: "method" };
  }

  if (url.search.length > 0) {
    return { cacheable: false, candidate: true, reason: "query" };
  }

  if (hasHeader(request, "Cookie")) {
    return { cacheable: false, candidate: true, reason: "cookie" };
  }

  if (RSC_VARIANT_HEADERS.some((headerName) => hasHeader(request, headerName))) {
    return { cacheable: false, candidate: true, reason: "rsc" };
  }

  if (!acceptsHtml(request)) {
    return { cacheable: false, candidate: true, reason: "accept" };
  }

  return {
    cacheKey: createHtmlEdgeCacheKey(request),
    cacheable: true,
    candidate: true,
    reason: "html",
  };
}

export function withHtmlEdgeCacheHeader(response, value) {
  const headers = new Headers(response.headers);
  headers.set(HTML_EDGE_CACHE_HEADER, value);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export function toHtmlEdgeCacheResponse(response) {
  const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";

  if (
    response.status !== 200 ||
    !contentType.includes("text/html") ||
    response.headers.has("Set-Cookie")
  ) {
    return null;
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", HTML_EDGE_CACHE_CONTROL);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
