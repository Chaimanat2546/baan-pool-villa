const HTML_EDGE_CACHE_SECONDS = 6 * 60 * 60;
const VILLA_DETAIL_HTML_EDGE_CACHE_SECONDS = 15 * 60;
const IMAGE_EDGE_CACHE_SECONDS = 365 * 24 * 60 * 60;
const IMAGE_EDGE_STALE_SECONDS = 365 * 24 * 60 * 60;
const HOUSE_JSON_EDGE_CACHE_SECONDS = 6 * 60 * 60;
const JSON_EDGE_CACHE_SECONDS = 12 * 60 * 60;
const IMAGE_TRANSFORM_WIDTHS = new Set([
  64,
  96,
  128,
  160,
  192,
  244,
  256,
  292,
  320,
  384,
  390,
  448,
  512,
  640,
  750,
  828,
  1080,
  1200,
  1440,
  1920,
]);
const IMAGE_TRANSFORM_QUALITIES = new Set([60, 75]);
const VILLA_IMAGE_DISPLAY_QUERY_KEYS = new Set(["imageId", "url", "w", "q"]);

export const HTML_EDGE_CACHE_CONTROL = `public, max-age=0, s-maxage=${HTML_EDGE_CACHE_SECONDS}`;
export const VILLA_DETAIL_HTML_EDGE_CACHE_CONTROL = `public, max-age=0, s-maxage=${VILLA_DETAIL_HTML_EDGE_CACHE_SECONDS}`;
export const HTML_BROWSER_CACHE_CONTROL =
  "private, no-cache, max-age=0, must-revalidate";
export const HTML_EDGE_CACHE_HEADER = "x-bpv-html-cache";
export const HTML_EDGE_CACHE_VERSION_PARAM = "__bpv_html_v";
export const IMAGE_EDGE_CACHE_CONTROL = `public, max-age=${IMAGE_EDGE_CACHE_SECONDS}, s-maxage=${IMAGE_EDGE_CACHE_SECONDS}, stale-while-revalidate=${IMAGE_EDGE_STALE_SECONDS}`;
export const IMAGE_EDGE_CACHE_HEADER = "x-bpv-image-cache";
export const HOUSE_JSON_EDGE_CACHE_CONTROL = `public, s-maxage=${HOUSE_JSON_EDGE_CACHE_SECONDS}, stale-while-revalidate=${HOUSE_JSON_EDGE_CACHE_SECONDS}`;
export const JSON_EDGE_CACHE_CONTROL = `public, s-maxage=${JSON_EDGE_CACHE_SECONDS}, stale-while-revalidate=${JSON_EDGE_CACHE_SECONDS}`;
export const JSON_EDGE_CACHE_HEADER = "x-bpv-json-cache";
export const JSON_EDGE_CACHE_VERSION_PARAM = "__bpv_json_v";
export const STATIC_ASSET_CACHE_CONTROL =
  "public, max-age=31536000, immutable";

export const HTML_CACHE_VERSION_GROUPS = {
  detailLayout: "detail-layout",
  customerReviews: "customer-reviews",
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

function parseImageTransformInteger(value) {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  return Number.parseInt(value, 10);
}

function getImageTransformDecision(url) {
  const widthValue = url.searchParams.get("w");
  const qualityValue = url.searchParams.get("q");
  const transform = {};

  if (widthValue !== null) {
    const width = parseImageTransformInteger(widthValue);

    if (width === null || !IMAGE_TRANSFORM_WIDTHS.has(width)) {
      return { transform: null, valid: false };
    }

    transform.width = width;
  }

  if (qualityValue !== null) {
    const quality = parseImageTransformInteger(qualityValue);

    if (quality === null || !IMAGE_TRANSFORM_QUALITIES.has(quality)) {
      return { transform: null, valid: false };
    }

    transform.quality = quality;
  }

  return { transform, valid: true };
}

function getPreferredImageCacheFormat(request) {
  const accept = request.headers.get("Accept")?.toLowerCase() ?? "";

  if (accept.includes("image/avif")) {
    return "avif";
  }

  if (accept.includes("image/webp")) {
    return "webp";
  }

  return "original";
}

export function isNextStaticAssetPath(pathname) {
  return pathname.startsWith("/_next/static/");
}

function getHtmlCacheVersionGroups(pathname) {
  if (pathname === "/") {
    return [
      HTML_CACHE_VERSION_GROUPS.siteSettings,
      HTML_CACHE_VERSION_GROUPS.homeSections,
      HTML_CACHE_VERSION_GROUPS.guides,
      HTML_CACHE_VERSION_GROUPS.customerReviews,
      HTML_CACHE_VERSION_GROUPS.villaListings,
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
  const suffix = "/images";

  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) {
    return false;
  }

  const id = pathname.slice(prefix.length, -suffix.length);

  return /^[1-9]\d*$/.test(id);
}

function isLegacyVillaImageProxyPath(pathname) {
  const prefix = "/api/villas/";
  const suffix = "/images/proxy";

  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) {
    return false;
  }

  const id = pathname.slice(prefix.length, -suffix.length);

  return /^[1-9]\d*$/.test(id);
}

function getVillaImageId(url) {
  const imageId = url.searchParams.get("imageId") ?? "";

  return isVillaImageProxyPath(url.pathname) && /^[1-9]\d*$/.test(imageId)
    ? imageId
    : "";
}

function hasValidVillaImageDisplayQuery(url) {
  const entries = Array.from(url.searchParams.entries());
  const seenKeys = new Set();

  for (const [key] of entries) {
    if (!VILLA_IMAGE_DISPLAY_QUERY_KEYS.has(key) || seenKeys.has(key)) {
      return false;
    }

    seenKeys.add(key);
  }

  const hasImageId = url.searchParams.has("imageId");
  const hasSourceUrl = url.searchParams.has("url");

  if (hasImageId === hasSourceUrl) {
    return false;
  }

  const imageId = getVillaImageId(url);
  const sourceUrl = url.searchParams.get("url") ?? "";

  return (
    (!hasImageId || Boolean(imageId)) &&
    (!hasSourceUrl || Boolean(sourceUrl)) &&
    getImageTransformDecision(url).valid
  );
}

function isHouseCoverImageProxyPath(pathname) {
  const prefix = "/api/houses/images/";
  const id = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "";

  return /^[1-9]\d*$/.test(id);
}

function isGuideCoverImageProxyPath(pathname) {
  const prefix = "/api/guides/images/";
  const suffix = "/cover";

  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) {
    return false;
  }

  const slug = pathname.slice(prefix.length, -suffix.length);

  return slug.length > 0 && !slug.includes("/");
}

function isGuideContentImageProxyPath(pathname) {
  const prefix = "/api/guides/images/";
  const marker = "/content/";

  if (!pathname.startsWith(prefix) || !pathname.includes(marker)) {
    return false;
  }

  const rest = pathname.slice(prefix.length);
  const markerIndex = rest.indexOf(marker);
  const slug = rest.slice(0, markerIndex);
  const index = rest.slice(markerIndex + marker.length);

  return slug.length > 0 && !slug.includes("/") && /^\d+$/.test(index);
}

function isResolvedPublicImageProxyPath(pathname) {
  return (
    isHouseCoverImageProxyPath(pathname) ||
    isGuideCoverImageProxyPath(pathname) ||
    isGuideContentImageProxyPath(pathname)
  );
}

function isPublicImageProxyPath(pathname) {
  return (
    pathname === "/api/houses/images/proxy" ||
    pathname === "/api/site-assets/proxy" ||
    pathname === "/api/guides/images/proxy" ||
    pathname === "/api/tiktok/images/proxy" ||
    isResolvedPublicImageProxyPath(pathname) ||
    isVillaImageProxyPath(pathname) ||
    isLegacyVillaImageProxyPath(pathname)
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

function isVillaBookingCalendarApiPath(pathname) {
  const prefix = "/api/villas/";
  const suffix = "/booking-calendar";

  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) {
    return false;
  }

  const id = pathname.slice(prefix.length, -suffix.length);

  // Classify every non-empty single ID segment here. Validation belongs to
  // the Next handler after the Worker host, Bearer, and rate-limit guards.
  return id.length > 0 && !id.includes("/");
}

function isDirectWorkersDevHostname(hostname) {
  const labels = hostname.split(".");

  return (
    labels.length === 4 &&
    labels.every((label) => label.length > 0) &&
    labels[2] === "workers" &&
    labels[3] === "dev"
  );
}

export function getBookingCalendarAccessDecision(
  request,
  configuredSiteUrl,
) {
  const requestUrl = new URL(request.url);

  // This guard protects only the private booking-calendar API. Other routes
  // continue through the existing Worker cache and OpenNext flow unchanged.
  if (!isVillaBookingCalendarApiPath(requestUrl.pathname)) {
    return { allowed: true, candidate: false, reason: "path" };
  }

  let siteUrl;

  try {
    siteUrl = new URL(configuredSiteUrl);
  } catch {
    // Fail closed when production configuration is missing or malformed so a
    // Worker alias or sibling subdomain cannot accidentally expose calendars.
    return { allowed: false, candidate: true, reason: "config" };
  }

  const isWwwHostname = siteUrl.hostname.startsWith("www.");
  const isDirectWorkersDevHostnameConfig = isDirectWorkersDevHostname(
    siteUrl.hostname,
  );

  if (
    siteUrl.protocol !== "https:" ||
    (!isWwwHostname && !isDirectWorkersDevHostnameConfig)
  ) {
    return { allowed: false, candidate: true, reason: "config" };
  }

  if (requestUrl.protocol !== "https:") {
    return { allowed: false, candidate: true, reason: "protocol" };
  }

  // A configured www hostname may also serve its one exact apex counterpart.
  // Sibling hosts such as cl.example.com are never included.
  const apexHostname = isWwwHostname
    ? siteUrl.hostname.slice("www.".length)
    : null;
  const isAllowedHostname = isDirectWorkersDevHostnameConfig
    ? requestUrl.hostname === siteUrl.hostname
    : requestUrl.hostname === siteUrl.hostname ||
      requestUrl.hostname === apexHostname;

  if (!isAllowedHostname) {
    return { allowed: false, candidate: true, reason: "hostname" };
  }

  return { allowed: true, candidate: true, reason: "hostname" };
}

function hasOnlyVillaCardImagesQuery(url) {
  const entries = Array.from(url.searchParams.entries());

  return (
    isVillaImagesApiPath(url.pathname) &&
    entries.length === 1 &&
    entries[0][0] === "view" &&
    entries[0][1] === "card"
  );
}

function hasValidHomeDeferredQuery(url) {
  const entries = Array.from(url.searchParams.entries());

  if (entries.length === 0) {
    return true;
  }

  return (
    entries.length === 1 &&
    entries[0][0] === "criticalRail" &&
    entries[0][1].length <= 128 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entries[0][1])
  );
}

function getJsonCacheVersionGroups(pathname) {
  if (pathname === "/api/houses") {
    return [HTML_CACHE_VERSION_GROUPS.villaListings];
  }

  if (pathname === "/api/home-sections") {
    return [HTML_CACHE_VERSION_GROUPS.homeSections];
  }

  if (pathname === "/api/home-deferred") {
    return [
      HTML_CACHE_VERSION_GROUPS.homeSections,
      HTML_CACHE_VERSION_GROUPS.guides,
      HTML_CACHE_VERSION_GROUPS.customerReviews,
      HTML_CACHE_VERSION_GROUPS.villaListings,
    ];
  }

  if (isVillaDetailApiPath(pathname)) {
    return [HTML_CACHE_VERSION_GROUPS.villaDetails];
  }

  if (isVillaImagesApiPath(pathname)) {
    return [HTML_CACHE_VERSION_GROUPS.villaImages];
  }

  return [];
}

function getHtmlCacheControl(pathname) {
  return isVillaDetailPath(pathname)
    ? VILLA_DETAIL_HTML_EDGE_CACHE_CONTROL
    : HTML_EDGE_CACHE_CONTROL;
}

function getJsonCacheControl(pathname) {
  if (pathname === "/api/houses") {
    return HOUSE_JSON_EDGE_CACHE_CONTROL;
  }

  return JSON_EDGE_CACHE_CONTROL;
}

export function createImageEdgeCacheKey(request) {
  const url = new URL(request.url);

  if (
    isVillaImageProxyPath(url.pathname) &&
    !hasValidVillaImageDisplayQuery(url)
  ) {
    return null;
  }

  const sourceUrl = url.searchParams.get("url") ?? "";
  const imageId = getVillaImageId(url);
  const transformDecision = getImageTransformDecision(url);
  url.hash = "";
  url.search = "";

  if (sourceUrl) {
    url.searchParams.set("url", sourceUrl);
  }

  if (imageId) {
    url.searchParams.set("imageId", imageId);
  }

  if (transformDecision.valid) {
    const { quality, width } = transformDecision.transform;

    if (width) {
      url.searchParams.set("w", width.toString());
    }

    if (quality) {
      url.searchParams.set("q", quality.toString());
    }

    if (width || quality) {
      url.searchParams.set("f", getPreferredImageCacheFormat(request));
    }
  }

  return new Request(url.toString(), { method: "GET" });
}

export function createJsonEdgeCacheKey(request, versionToken = "") {
  const url = new URL(request.url);
  const isVillaCardImagesQuery = hasOnlyVillaCardImagesQuery(url);
  const criticalRailKey =
    url.pathname === "/api/home-deferred" && hasValidHomeDeferredQuery(url)
      ? url.searchParams.get("criticalRail")
      : null;

  url.search = "";
  url.hash = "";

  if (isVillaCardImagesQuery) {
    url.searchParams.set("view", "card");
  }

  if (criticalRailKey) {
    url.searchParams.set("criticalRail", criticalRailKey);
  }

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
    cacheControl: getHtmlCacheControl(url.pathname),
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

  if (
    isVillaImageProxyPath(url.pathname) &&
    !hasValidVillaImageDisplayQuery(url)
  ) {
    return { cacheable: false, candidate: false, reason: "path" };
  }

  if (isVillaImageProxyPath(url.pathname) && url.searchParams.get("download") === "1") {
    return { cacheable: false, candidate: false, reason: "path" };
  }

  if (
    !url.searchParams.get("url") &&
    isVillaImageProxyPath(url.pathname) &&
    !getVillaImageId(url)
  ) {
    return { cacheable: false, candidate: false, reason: "path" };
  }

  if (
    !url.searchParams.get("url") &&
    !getVillaImageId(url) &&
    !isResolvedPublicImageProxyPath(url.pathname)
  ) {
    return { cacheable: false, candidate: true, reason: "url" };
  }

  if (!getImageTransformDecision(url).valid) {
    return { cacheable: false, candidate: true, reason: "transform" };
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
    url.pathname === "/api/home-deferred" ||
    isVillaDetailApiPath(url.pathname) ||
    hasOnlyVillaCardImagesQuery(url);

  if (!isCandidatePath) {
    return { cacheable: false, candidate: false, reason: "path" };
  }

  if (request.method !== "GET") {
    return { cacheable: false, candidate: true, reason: "method" };
  }

  if (isVillaImagesApiPath(url.pathname)) {
    if (url.search.length > 0 && !hasOnlyVillaCardImagesQuery(url)) {
      return { cacheable: false, candidate: true, reason: "query" };
    }
  } else if (
    url.pathname === "/api/home-deferred"
      ? !hasValidHomeDeferredQuery(url)
      : url.search.length > 0
  ) {
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
    cacheControl: getJsonCacheControl(url.pathname),
    cacheable: true,
    candidate: true,
    reason: "json",
    versionGroups: getJsonCacheVersionGroups(url.pathname),
  };
}

export function withHtmlEdgeCacheHeader(response, value) {
  const headers = new Headers(response.headers);
  const contentType = headers.get("Content-Type")?.toLowerCase() ?? "";

  if (contentType.includes("text/html")) {
    headers.set("Cache-Control", HTML_BROWSER_CACHE_CONTROL);
  }

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

export function withStaticAssetCacheHeaders(response) {
  if (!response.ok) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", STATIC_ASSET_CACHE_CONTROL);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export function toHtmlEdgeCacheResponse(
  response,
  cacheControl = HTML_EDGE_CACHE_CONTROL,
) {
  const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";

  if (
    response.status !== 200 ||
    !contentType.includes("text/html") ||
    response.headers.has("Set-Cookie")
  ) {
    return null;
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", cacheControl);

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

export function toJsonEdgeCacheResponse(
  response,
  cacheControl = JSON_EDGE_CACHE_CONTROL,
) {
  const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";

  if (
    response.status !== 200 ||
    !contentType.includes("application/json") ||
    response.headers.has("Set-Cookie")
  ) {
    return null;
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", cacheControl);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
