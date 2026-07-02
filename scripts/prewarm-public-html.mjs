import { fileURLToPath } from "node:url";

const DEFAULT_MAX_DYNAMIC_ROUTES = 60;
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_VERIFY_DELAY_MS = 750;
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const HTML_CACHE_HEADER = "x-bpv-html-cache";
const SEARCH_FILTER_PREWARM_PATH = "/search?guests=2&bedrooms=1&maxPrice=58900";
const PREWARM_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent": "baan-pool-villa-cache-prewarm/1.0",
};
const FIXED_PUBLIC_HTML_PATHS = [
  "/",
  "/search",
  SEARCH_FILTER_PREWARM_PATH,
  "/guides",
  "/terms",
  "/privacy",
];

function stripXmlComments(xml) {
  let result = "";
  let cursor = 0;

  while (cursor < xml.length) {
    const commentStart = xml.indexOf("<!--", cursor);

    if (commentStart === -1) {
      result += xml.slice(cursor);
      break;
    }

    result += xml.slice(cursor, commentStart);

    const commentEnd = xml.indexOf("-->", commentStart + 4);
    cursor = commentEnd === -1 ? xml.length : commentEnd + 3;
  }

  return result;
}

function decodeXmlText(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

export function resolvePrewarmBaseUrl(env = process.env, explicitUrl) {
  const configuredUrl =
    explicitUrl || env.BPV_PREWARM_BASE_URL || env.NEXT_PUBLIC_SITE_URL;

  if (!configuredUrl) {
    throw new Error(
      "Missing prewarm base URL. Set BPV_PREWARM_BASE_URL, NEXT_PUBLIC_SITE_URL, or pass --url=https://example.com.",
    );
  }

  try {
    return normalizeBaseUrl(configuredUrl);
  } catch {
    throw new Error("Invalid prewarm base URL.");
  }
}

export function parseSitemapLocations(xml) {
  const withoutComments = stripXmlComments(xml);
  const locations = [];
  let cursor = 0;

  while (cursor < withoutComments.length) {
    const locStart = withoutComments.indexOf("<loc>", cursor);

    if (locStart === -1) {
      break;
    }

    const valueStart = locStart + "<loc>".length;
    const locEnd = withoutComments.indexOf("</loc>", valueStart);

    if (locEnd === -1) {
      break;
    }

    const value = decodeXmlText(withoutComments.slice(valueStart, locEnd).trim());

    if (value) {
      locations.push(value);
    }

    cursor = locEnd + "</loc>".length;
  }

  return locations;
}

function normalizeBaseUrl(baseUrl) {
  const url = new URL(baseUrl);
  url.hash = "";
  url.search = "";
  url.pathname = "";

  return url.toString().replace(/\/$/, "");
}

async function fetchWithTimeout(
  url,
  init,
  { fetchImpl, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS },
) {
  const controller = new AbortController();
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Prewarm request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetchImpl(url, {
        ...init,
        signal: controller.signal,
      }),
      timeoutPromise,
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizePath(value, baseUrl) {
  const url = new URL(value, baseUrl);
  const base = new URL(baseUrl);
  const path = `${url.pathname || "/"}${url.search}`;

  if (url.origin !== base.origin || url.hash) {
    return null;
  }

  if (url.search && !FIXED_PUBLIC_HTML_PATHS.includes(path)) {
    return null;
  }

  return path;
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

function isPublicHtmlPrewarmPath(pathname) {
  return (
    FIXED_PUBLIC_HTML_PATHS.includes(pathname) ||
    isGuideDetailPath(pathname) ||
    isVillaDetailPath(pathname)
  );
}

function isDynamicPrewarmPath(pathname) {
  return !FIXED_PUBLIC_HTML_PATHS.includes(pathname);
}

function pushUniquePath(paths, pathname) {
  if (!paths.includes(pathname)) {
    paths.push(pathname);
  }
}

export async function collectPrewarmPaths({
  baseUrl = resolvePrewarmBaseUrl(),
  fetchTimeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
  fetchImpl = fetch,
  maxDynamicRoutes = DEFAULT_MAX_DYNAMIC_ROUTES,
  paths,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const selectedPaths = [];

  if (paths?.length) {
    for (const path of paths) {
      const pathname = normalizePath(path, normalizedBaseUrl);

      if (pathname && isPublicHtmlPrewarmPath(pathname)) {
        pushUniquePath(selectedPaths, pathname);
      }
    }

    return selectedPaths;
  }

  FIXED_PUBLIC_HTML_PATHS.forEach((path) => {
    pushUniquePath(selectedPaths, path);
  });

  let sitemapResponse;

  try {
    sitemapResponse = await fetchWithTimeout(
      `${normalizedBaseUrl}/sitemap.xml`,
      {
        headers: { Accept: "application/xml,text/xml,*/*" },
        method: "GET",
      },
      { fetchImpl, timeoutMs: fetchTimeoutMs },
    );
  } catch {
    return selectedPaths;
  }

  if (!sitemapResponse.ok) {
    return selectedPaths;
  }

  const dynamicPaths = [];
  const locations = parseSitemapLocations(await sitemapResponse.text());

  for (const location of locations) {
    const pathname = normalizePath(location, normalizedBaseUrl);

    if (
      pathname &&
      isPublicHtmlPrewarmPath(pathname) &&
      isDynamicPrewarmPath(pathname) &&
      !dynamicPaths.includes(pathname)
    ) {
      dynamicPaths.push(pathname);
    }

    if (dynamicPaths.length >= maxDynamicRoutes) {
      break;
    }
  }

  dynamicPaths.forEach((path) => {
    pushUniquePath(selectedPaths, path);
  });

  return selectedPaths;
}

function getCacheHeader(response) {
  return response.headers.get(HTML_CACHE_HEADER)?.toUpperCase() ?? "";
}

async function requestHtml(url, fetchImpl, fetchTimeoutMs) {
  return fetchWithTimeout(
    url,
    {
      headers: PREWARM_HEADERS,
      method: "GET",
      redirect: "manual",
    },
    { fetchImpl, timeoutMs: fetchTimeoutMs },
  );
}

function createEmptySummary(requested) {
  return {
    bypassed: 0,
    failed: 0,
    hit: 0,
    miss: 0,
    requested,
    verifiedHit: 0,
  };
}

function mergeSummary(target, source) {
  target.bypassed += source.bypassed;
  target.failed += source.failed;
  target.hit += source.hit;
  target.miss += source.miss;
  target.verifiedHit += source.verifiedHit;
}

async function prewarmPath({
  baseUrl,
  fetchImpl,
  fetchTimeoutMs,
  path,
  verify,
  wait,
}) {
  const summary = createEmptySummary(1);
  const url = `${baseUrl}${path}`;
  let response;

  try {
    response = await requestHtml(url, fetchImpl, fetchTimeoutMs);
  } catch {
    summary.failed += 1;

    return summary;
  }

  const cacheHeader = getCacheHeader(response);

  if (!response.ok) {
    summary.failed += 1;
    return summary;
  }

  if (cacheHeader === "HIT") {
    summary.hit += 1;
    return summary;
  }

  if (cacheHeader === "MISS") {
    summary.miss += 1;

    if (!verify) {
      return summary;
    }

    await wait();

    let verificationResponse;

    try {
      verificationResponse = await requestHtml(url, fetchImpl, fetchTimeoutMs);
    } catch {
      summary.failed += 1;

      return summary;
    }

    const verificationCacheHeader = getCacheHeader(verificationResponse);

    if (verificationResponse.ok && verificationCacheHeader === "HIT") {
      summary.hit += 1;
      summary.verifiedHit += 1;
      return summary;
    }

    if (verificationResponse.ok && verificationCacheHeader === "MISS") {
      summary.miss += 1;
    } else if (verificationResponse.ok && verificationCacheHeader === "BYPASS") {
      summary.bypassed += 1;
    } else {
      summary.failed += 1;
    }

    return summary;
  }

  if (cacheHeader === "BYPASS") {
    summary.bypassed += 1;
    return summary;
  }

  summary.failed += 1;
  return summary;
}

async function runPool(items, concurrency, runner) {
  const workers = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await runner(item);
    }
  }

  for (let index = 0; index < Math.min(concurrency, items.length); index += 1) {
    workers.push(worker());
  }

  await Promise.all(workers);
}

export async function prewarmPublicHtml({
  baseUrl = resolvePrewarmBaseUrl(),
  concurrency = DEFAULT_CONCURRENCY,
  fetchTimeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
  fetchImpl = fetch,
  maxDynamicRoutes = DEFAULT_MAX_DYNAMIC_ROUTES,
  paths,
  verify = true,
  verifyDelayMs = DEFAULT_VERIFY_DELAY_MS,
  wait = () =>
    new Promise((resolve) => {
      setTimeout(resolve, verifyDelayMs);
    }),
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedPaths =
    paths ??
    (await collectPrewarmPaths({
      baseUrl: normalizedBaseUrl,
      fetchImpl,
      fetchTimeoutMs,
      maxDynamicRoutes,
    }));
  const summary = createEmptySummary(normalizedPaths.length);

  await runPool(normalizedPaths, Math.max(1, concurrency), async (path) => {
    const pathSummary = await prewarmPath({
      baseUrl: normalizedBaseUrl,
      fetchImpl,
      fetchTimeoutMs,
      path,
      verify,
      wait,
    });
    mergeSummary(summary, pathSummary);
  });

  return summary;
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(argv) {
  const options = {
    baseUrl: undefined,
    concurrency: DEFAULT_CONCURRENCY,
    fetchTimeoutMs: DEFAULT_FETCH_TIMEOUT_MS,
    maxDynamicRoutes: DEFAULT_MAX_DYNAMIC_ROUTES,
    paths: [],
    verify: true,
  };

  for (const arg of argv) {
    if (arg.startsWith("--url=")) {
      options.baseUrl = arg.slice("--url=".length);
    } else if (arg.startsWith("--max-dynamic=")) {
      options.maxDynamicRoutes = parseInteger(
        arg.slice("--max-dynamic=".length),
        DEFAULT_MAX_DYNAMIC_ROUTES,
      );
    } else if (arg.startsWith("--concurrency=")) {
      options.concurrency = parseInteger(
        arg.slice("--concurrency=".length),
        DEFAULT_CONCURRENCY,
      );
    } else if (arg.startsWith("--timeout-ms=")) {
      options.fetchTimeoutMs = parseInteger(
        arg.slice("--timeout-ms=".length),
        DEFAULT_FETCH_TIMEOUT_MS,
      );
    } else if (arg.startsWith("--path=")) {
      options.paths.push(arg.slice("--path=".length));
    } else if (arg === "--no-verify") {
      options.verify = false;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.baseUrl = resolvePrewarmBaseUrl(process.env, options.baseUrl);

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const paths = await collectPrewarmPaths(options);
  const summary = await prewarmPublicHtml({
    ...options,
    paths,
  });

  console.log(
    [
      `Prewarmed ${summary.requested} public HTML path(s).`,
      `MISS=${summary.miss}`,
      `HIT=${summary.hit}`,
      `verifiedHit=${summary.verifiedHit}`,
      `BYPASS=${summary.bypassed}`,
      `failed=${summary.failed}`,
    ].join(" "),
  );

  if (summary.failed > 0 || summary.bypassed > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
