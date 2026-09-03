const AUTOMATED_USER_AGENT_MARKERS = [
  "aiohttp",
  "axios/",
  "curl/",
  "go-http-client/",
  "node-fetch",
  "postmanruntime/",
  "python-httpx/",
  "python-requests/",
  "scrapy/",
  "undici",
  "wget/",
];

const CACHE_HEADERS = [
  "x-bpv-json-cache",
  "x-bpv-html-cache",
  "x-bpv-image-cache",
  "cf-cache-status",
];

function toBoundedString(value, maxLength) {
  return typeof value === "string"
    ? value.replaceAll(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, maxLength) || null
    : null;
}

function getRouteDetails(pathname) {
  const normalizedPathname =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  if (normalizedPathname === "/") {
    return { routeKind: "home_page" };
  }

  if (normalizedPathname === "/search") {
    return { routeKind: "villa_search_page" };
  }

  if (normalizedPathname === "/api/home-sections") {
    return { routeKind: "home_sections_api" };
  }

  if (normalizedPathname === "/api/home-deferred") {
    return { routeKind: "home_deferred_api" };
  }

  if (normalizedPathname === "/api/houses") {
    return { routeKind: "villa_catalog_api" };
  }

  if (normalizedPathname === "/sitemap.xml") {
    return { routeKind: "villa_sitemap" };
  }

  const detailMatch = normalizedPathname.match(
    /^\/api\/villas\/([1-9]\d{0,15})$/,
  );

  if (detailMatch) {
    const villaId = Number(detailMatch[1]);

    if (!Number.isSafeInteger(villaId)) {
      return null;
    }

    return {
      routeKind: "villa_detail_api",
      villaId,
    };
  }

  const detailPageMatch = normalizedPathname.match(
    /^\/villas\/([1-9]\d{0,15})$/,
  );

  if (detailPageMatch) {
    const villaId = Number(detailPageMatch[1]);

    if (!Number.isSafeInteger(villaId)) {
      return null;
    }

    return {
      routeKind: "villa_detail_page",
      villaId,
    };
  }

  return null;
}

function getEdgeCacheStatus(response) {
  if (!response) {
    return null;
  }

  for (const headerName of CACHE_HEADERS) {
    const value = toBoundedString(response.headers.get(headerName), 32);

    if (value) {
      return value;
    }
  }

  return null;
}

function getReasons(request, response, routeKind) {
  const reasons = [];
  const userAgent = request.headers.get("User-Agent")?.trim() ?? "";
  const normalizedUserAgent = userAgent.toLowerCase();

  if (!userAgent) {
    reasons.push("missing_user_agent");
  } else if (
    AUTOMATED_USER_AGENT_MARKERS.some((marker) =>
      normalizedUserAgent.includes(marker),
    )
  ) {
    reasons.push("automated_user_agent");
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    reasons.push("unexpected_method");
  }

  if (!response) {
    reasons.push("upstream_exception");
  } else if (response.status >= 400) {
    reasons.push("http_error");
  }

  if (
    reasons.length === 0 &&
    (routeKind === "villa_catalog_api" || routeKind === "villa_detail_api")
  ) {
    reasons.push("listing_api_access");
  }

  return reasons;
}

export function createSuspiciousListingRequestEvent(request, response) {
  const url = new URL(request.url);
  const routeDetails = getRouteDetails(url.pathname);

  if (!routeDetails) {
    return null;
  }

  const reasons = getReasons(request, response, routeDetails.routeKind);

  if (reasons.length === 0) {
    return null;
  }

  const cf = request.cf ?? {};
  const asn = Number.isSafeInteger(cf.asn) && cf.asn > 0 ? cf.asn : null;

  return {
    asn,
    asOrganization: toBoundedString(cf.asOrganization, 160),
    clientIp: toBoundedString(
      request.headers.get("CF-Connecting-IP"),
      64,
    ),
    colo: toBoundedString(cf.colo, 16),
    country: toBoundedString(cf.country, 8),
    edgeCache: getEdgeCacheStatus(response),
    event: "suspicious_listing_request",
    host: url.hostname,
    method: request.method,
    pathname: url.pathname,
    rayId: toBoundedString(request.headers.get("CF-Ray"), 64),
    reasons,
    ...routeDetails,
    status: response?.status ?? null,
    upstreamWorker: toBoundedString(
      request.headers.get("CF-Worker"),
      253,
    ),
    userAgent: toBoundedString(request.headers.get("User-Agent"), 512),
  };
}

export function logSuspiciousListingRequest(request, response) {
  try {
    const event = createSuspiciousListingRequestEvent(request, response);

    if (event) {
      const show = (value) =>
        value == null || value === ""
          ? "-"
          : String(value).replaceAll("|", "/");
      const asn = event.asn == null ? "-" : `AS${event.asn}`;

      console.warn(
        [
          `UA: ${show(event.userAgent)}`,
          `IP: ${show(event.clientIp)}`,
          `ASN: ${asn}`,
          `ISP: ${show(event.asOrganization)}`,
          `Country: ${show(event.country)}`,
          `Colo: ${show(event.colo)}`,
          `Host: ${show(event.host)}`,
          `Method: ${show(event.method)}`,
          `Path: ${show(event.pathname)}`,
          `Route: ${show(event.routeKind)}`,
          `Status: ${show(event.status)}`,
          `Cache: ${show(event.edgeCache)}`,
          `Ray: ${show(event.rayId)}`,
          `Reason: ${show(event.reasons.join(","))}`,
          `CF-Worker: ${show(event.upstreamWorker)}`,
        ].join(" | "),
      );
    }
  } catch {
    // Observability must never change the response or replace its error.
  }
}
