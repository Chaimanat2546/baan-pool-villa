const HTML_EDGE_CACHE_SECONDS = 300;
const IMAGE_EDGE_CACHE_SECONDS = 24 * 60 * 60;
const IMAGE_EDGE_STALE_SECONDS = 7 * 24 * 60 * 60;
const JSON_EDGE_CACHE_SECONDS = 12 * 60 * 60;

export const HTML_EDGE_CACHE_CONTROL = `public, max-age=0, s-maxage=${HTML_EDGE_CACHE_SECONDS}`;
export const HTML_EDGE_CACHE_HEADER = "x-bpv-html-cache";
export const HTML_EDGE_CACHE_VERSION_PARAM = "__bpv_html_v";
export const IMAGE_EDGE_CACHE_CONTROL = `public, max-age=${IMAGE_EDGE_CACHE_SECONDS}, s-maxage=${IMAGE_EDGE_CACHE_SECONDS}, stale-while-revalidate=${IMAGE_EDGE_STALE_SECONDS}`;
export const IMAGE_EDGE_CACHE_HEADER = "x-bpv-image-cache";
export const JSON_EDGE_CACHE_CONTROL = `public, s-maxage=${JSON_EDGE_CACHE_SECONDS}, stale-while-revalidate=${JSON_EDGE_CACHE_SECONDS}`;
export const JSON_EDGE_CACHE_HEADER = "x-bpv-json-cache";
export const JSON_EDGE_CACHE_VERSION_PARAM = "__bpv_json_v";

export const HTML_CACHE_VERSION_GROUPS = {
  detailLayout: "detail-layout",
  guides: "guides",
  homeSections: "home-sections",
  legalPages: "legal-pages",
  siteSettings: "site-settings",
  villaDetails: "villa-details",
  villaImages: "villa-images",
  villaListings: "villa-listings",
};

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

function acceptsImage(request) {
  const accept = request.headers.get("Accept")?.toLowerCase().trim();

  return !accept || accept.includes("image/") || accept.includes("*/*");
}

function acceptsJson(request) {
  const accept = request.headers.get("Accept")?.toLowerCase().trim();

  return !accept || accept.includes("application/json") || accept.includes("*/*");
}

function isGuideDetailPath(pathname) {
  if (!pathname.startsWith("/guides/")) {
    return false;
  }

  const slug = pathname.slice("/guides/".length);

  return slug.length > 0 && !slug.includes("/");
}

function isVillaDetailPath(pathname) {
  if (!pathname.startsWith("/villas/")) {
    return false;
  }

  const id = pathname.slice("/villas/".length);

  return /^[1-9]\d*$/.test(id);
}

export function isPublicHtmlCachePath(pathname) {
  return (
    PUBLIC_HTML_CACHE_PATHS.has(pathname) ||
    isGuideDetailPath(pathname) ||
    isVillaDetailPath(pathname)
  );
}

function getHtmlCacheVersionGroups(pathname) {
  if (pathname === "/") {
    return [
      HTML_CACHE_VERSION_GROUPS.siteSettings,
      HTML_CACHE_VERSION_GROUPS.homeSections,
      HTML_CACHE_VERSION_GROUPS.guides,
    ];
  }

  if (pathname === "/search") {
    return [HTML_CACHE_VERSION_GROUPS.siteSettings];
  }

  if (pathname === "/guides" || isGuideDetailPath(pathname)) {
    return [
      HTML_CACHE_VERSION_GROUPS.siteSettings,
      HTML_CACHE_VERSION_GROUPS.guides,
    ];
  }

  if (pathname === "/terms" || pathname === "/privacy") {
    return [
      HTML_CACHE_VERSION_GROUPS.siteSettings,
      HTML_CACHE_VERSION_GROUPS.legalPages,
    ];
  }

  if (isVillaDetailPath(pathname)) {
    return [
      HTML_CACHE_VERSION_GROUPS.siteSettings,
      HTML_CACHE_VERSION_GROUPS.homeSections,
      HTML_CACHE_VERSION_GROUPS.detailLayout,
      HTML_CACHE_VERSION_GROUPS.villaDetails,
      HTML_CACHE_VERSION_GROUPS.villaImages,
    ];
  }

  return [HTML_CACHE_VERSION_GROUPS.siteSettings];
}

export function createHtmlEdgeCacheKey(request, versionToken = "") {
  const url = new URL(request.url);
  url.search = "";
  url.hash = "";

  if (versionToken) {
    url.searchParams.set(HTML_EDGE_CACHE_VERSION_PARAM, versionToken);
  }

  return new Request(url.toString(), { method: "GET" });
}

export function createHtmlEdgeVersionToken({
  cmsVersionToken = "",
  deploymentVersionToken = "",
} = {}) {
  const normalizedDeploymentVersionToken = String(deploymentVersionToken).trim();
  const normalizedCmsVersionToken = String(cmsVersionToken).trim();
  const parts = [];

  if (normalizedDeploymentVersionToken) {
    parts.push(`deploy:${normalizedDeploymentVersionToken}`);
  }

  if (normalizedCmsVersionToken) {
    parts.push(normalizedCmsVersionToken);
  }

  return parts.join("|");
}

function isVillaImageProxyPath(pathname) {
  const prefix = "/api/villas/";
  const suffix = "/images/proxy";

  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) {
    return false;
  }

  const id = pathname.slice(prefix.length, -suffix.length);

  return /^[1-9]\d*$/.test(id);
}

function isPublicImageProxyPath(pathname) {
  return (
    pathname === "/api/houses/images/proxy" ||
    pathname === "/api/site-assets/proxy" ||
    pathname === "/api/guides/images/proxy" ||
    isVillaImageProxyPath(pathname)
  );
}

function isVillaDetailApiPath(pathname) {
  if (!pathname.startsWith("/api/villas/")) {
    return false;
  }

  const id = pathname.slice("/api/villas/".length);

  return /^[1-9]\d*$/.test(id);
}

function isVillaImagesApiPath(pathname) {
  const prefix = "/api/villas/";
  const suffix = "/images";

  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) {
    return false;
  }

  const id = pathname.slice(prefix.length, -suffix.length);

  return /^[1-9]\d*$/.test(id);
}

function getJsonCacheVersionGroups(pathname) {
  if (pathname === "/api/houses") {
    return [HTML_CACHE_VERSION_GROUPS.villaListings];
  }

  if (pathname === "/api/home-sections") {
    return [HTML_CACHE_VERSION_GROUPS.homeSections];
  }

  if (isVillaDetailApiPath(pathname)) {
    return [HTML_CACHE_VERSION_GROUPS.villaDetails];
  }

  if (isVillaImagesApiPath(pathname)) {
    return [HTML_CACHE_VERSION_GROUPS.villaImages];
  }

  return [];
}

export function createImageEdgeCacheKey(request) {
  const url = new URL(request.url);
  const sourceUrl = url.searchParams.get("url") ?? "";
  url.hash = "";
  url.search = "";

  if (sourceUrl) {
    url.searchParams.set("url", sourceUrl);
  }

  return new Request(url.toString(), { method: "GET" });
}

export function createJsonEdgeCacheKey(request, versionToken = "") {
  const url = new URL(request.url);
  url.search = "";
  url.hash = "";

  if (versionToken) {
    url.searchParams.set(JSON_EDGE_CACHE_VERSION_PARAM, versionToken);
  }

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
    versionGroups: getHtmlCacheVersionGroups(url.pathname),
  };
}

export function getImageEdgeCacheDecision(request) {
  const url = new URL(request.url);
  const isCandidatePath = isPublicImageProxyPath(url.pathname);

  if (!isCandidatePath) {
    return { cacheable: false, candidate: false, reason: "path" };
  }

  if (request.method !== "GET") {
    return { cacheable: false, candidate: true, reason: "method" };
  }

  if (!url.searchParams.get("url")) {
    return { cacheable: false, candidate: true, reason: "url" };
  }

  if (hasHeader(request, "Cookie")) {
    return { cacheable: false, candidate: true, reason: "cookie" };
  }

  if (!acceptsImage(request)) {
    return { cacheable: false, candidate: true, reason: "accept" };
  }

  return {
    cacheKey: createImageEdgeCacheKey(request),
    cacheable: true,
    candidate: true,
    reason: "image",
  };
}

export function getJsonEdgeCacheDecision(request) {
  const url = new URL(request.url);
  const isCandidatePath =
    url.pathname === "/api/houses" ||
    url.pathname === "/api/home-sections" ||
    isVillaDetailApiPath(url.pathname) ||
    isVillaImagesApiPath(url.pathname);

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

  if (!acceptsJson(request)) {
    return { cacheable: false, candidate: true, reason: "accept" };
  }

  return {
    cacheKey: createJsonEdgeCacheKey(request),
    cacheable: true,
    candidate: true,
    reason: "json",
    versionGroups: getJsonCacheVersionGroups(url.pathname),
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

export function withImageEdgeCacheHeader(response, value) {
  const headers = new Headers(response.headers);
  headers.set(IMAGE_EDGE_CACHE_HEADER, value);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export function withJsonEdgeCacheHeader(response, value) {
  const headers = new Headers(response.headers);
  headers.set(JSON_EDGE_CACHE_HEADER, value);

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

export function toImageEdgeCacheResponse(response) {
  const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";

  if (
    response.status !== 200 ||
    !contentType.startsWith("image/") ||
    response.headers.has("Set-Cookie")
  ) {
    return null;
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", IMAGE_EDGE_CACHE_CONTROL);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export function toJsonEdgeCacheResponse(response) {
  const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";

  if (
    response.status !== 200 ||
    !contentType.includes("application/json") ||
    response.headers.has("Set-Cookie")
  ) {
    return null;
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", JSON_EDGE_CACHE_CONTROL);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
