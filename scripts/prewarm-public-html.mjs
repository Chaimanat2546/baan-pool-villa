#!/usr/bin/env node

import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "https://baan-pool-villa.nutthawutprayoonklay.workers.dev";
const DEFAULT_MAX_DYNAMIC_ROUTES = 60;
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_VERIFY_DELAY_MS = 750;
const HTML_CACHE_HEADER = "x-bpv-html-cache";
const PREWARM_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent": "baan-pool-villa-cache-prewarm/1.0",
};
const FIXED_PUBLIC_HTML_PATHS = ["/", "/search", "/guides", "/terms", "/privacy"];

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

function normalizePath(value, baseUrl) {
  const url = new URL(value, baseUrl);
  const base = new URL(baseUrl);

  if (url.origin !== base.origin || url.search || url.hash) {
    return null;
  }

  return url.pathname || "/";
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
  baseUrl = DEFAULT_BASE_URL,
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

  const sitemapResponse = await fetchImpl(`${normalizedBaseUrl}/sitemap.xml`, {
    headers: { Accept: "application/xml,text/xml,*/*" },
    method: "GET",
  });

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

async function requestHtml(url, fetchImpl) {
  return fetchImpl(url, {
    headers: PREWARM_HEADERS,
    method: "GET",
    redirect: "manual",
  });
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

async function prewarmPath({ baseUrl, fetchImpl, path, verify, wait }) {
  const summary = createEmptySummary(1);
  const url = `${baseUrl}${path}`;
  const response = await requestHtml(url, fetchImpl);
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

    const verificationResponse = await requestHtml(url, fetchImpl);
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
  baseUrl = DEFAULT_BASE_URL,
  concurrency = DEFAULT_CONCURRENCY,
  fetchImpl = fetch,
  paths,
  verify = true,
  verifyDelayMs = DEFAULT_VERIFY_DELAY_MS,
  wait = () =>
    new Promise((resolve) => {
      setTimeout(resolve, verifyDelayMs);
    }),
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const summary = createEmptySummary(paths.length);

  await runPool(paths, Math.max(1, concurrency), async (path) => {
    const pathSummary = await prewarmPath({
      baseUrl: normalizedBaseUrl,
      fetchImpl,
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
    baseUrl: DEFAULT_BASE_URL,
    concurrency: DEFAULT_CONCURRENCY,
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
    } else if (arg.startsWith("--path=")) {
      options.paths.push(arg.slice("--path=".length));
    } else if (arg === "--no-verify") {
      options.verify = false;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

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
