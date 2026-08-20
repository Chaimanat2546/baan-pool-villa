import { describe, expect, it } from "vitest";

import {
  HTML_BROWSER_CACHE_CONTROL,
  HOUSE_JSON_EDGE_CACHE_CONTROL,
  HTML_EDGE_CACHE_CONTROL,
  HTML_EDGE_CACHE_HEADER,
  IMAGE_EDGE_CACHE_CONTROL,
  IMAGE_EDGE_CACHE_HEADER,
  JSON_EDGE_CACHE_CONTROL,
  JSON_EDGE_CACHE_HEADER,
  STATIC_ASSET_CACHE_CONTROL,
  VILLA_DETAIL_HTML_EDGE_CACHE_CONTROL,
  createHtmlEdgeCacheKey,
  createHtmlEdgeVersionToken,
  createImageEdgeCacheKey,
  createJsonEdgeCacheKey,
  getBookingCalendarAccessDecision,
  getHtmlEdgeCacheDecision,
  getImageEdgeCacheDecision,
  getJsonEdgeCacheDecision,
  isNextStaticAssetPath,
  isPublicHtmlCachePath,
  toHtmlEdgeCacheResponse,
  toImageEdgeCacheResponse,
  toJsonEdgeCacheResponse,
  withHtmlEdgeCacheHeader,
  withImageEdgeCacheHeader,
  withJsonEdgeCacheHeader,
  withStaticAssetCacheHeaders,
} from "./worker-cache-policy.js";

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://example.com${path}`, {
    method: "GET",
    ...init,
  });
}

describe("worker HTML edge cache policy", () => {
  it("keeps public HTML edge cache shared for six hours by default", () => {
    expect(HTML_EDGE_CACHE_CONTROL).toBe("public, max-age=0, s-maxage=21600");
  });

  it("keeps villa detail HTML edge cache shared for fifteen minutes", () => {
    expect(VILLA_DETAIL_HTML_EDGE_CACHE_CONTROL).toBe(
      "public, max-age=0, s-maxage=900",
    );
  });

  it("allows only the first conservative public HTML page batch", () => {
    expect(isPublicHtmlCachePath("/")).toBe(true);
    expect(isPublicHtmlCachePath("/search")).toBe(true);
    expect(isPublicHtmlCachePath("/guides")).toBe(true);
    expect(isPublicHtmlCachePath("/guides/family-trip")).toBe(true);
    expect(isPublicHtmlCachePath("/terms")).toBe(true);
    expect(isPublicHtmlCachePath("/privacy")).toBe(true);

    expect(isPublicHtmlCachePath("/api/houses")).toBe(false);
    expect(isPublicHtmlCachePath("/admin/login")).toBe(false);
    expect(isPublicHtmlCachePath("/_next/static/chunk.js")).toBe(false);
    expect(isPublicHtmlCachePath("/villas/9")).toBe(true);
    expect(isPublicHtmlCachePath("/guides/family-trip/extra")).toBe(false);
    expect(isPublicHtmlCachePath("/villas/9/gallery")).toBe(false);
  });

  it("bypasses variant, personalized, and non-HTML requests", () => {
    expect(getHtmlEdgeCacheDecision(request("/search?guests=10"))).toMatchObject({
      cacheable: false,
      candidate: true,
      reason: "query",
    });
    expect(
      getHtmlEdgeCacheDecision(
        request("/guides", { headers: { Cookie: "session=1" } }),
      ),
    ).toMatchObject({ cacheable: false, candidate: true, reason: "cookie" });
    expect(
      getHtmlEdgeCacheDecision(
        request("/guides", { headers: { RSC: "1" } }),
      ),
    ).toMatchObject({ cacheable: false, candidate: true, reason: "rsc" });
    expect(
      getHtmlEdgeCacheDecision(
        request("/guides", { headers: { Accept: "application/json" } }),
      ),
    ).toMatchObject({ cacheable: false, candidate: true, reason: "accept" });
    expect(
      getHtmlEdgeCacheDecision(request("/guides", { method: "POST" })),
    ).toMatchObject({ cacheable: false, candidate: true, reason: "method" });
  });

  it("builds a queryless GET cache key for cacheable public HTML requests", () => {
    const decision = getHtmlEdgeCacheDecision(
      request("/guides", { headers: { Accept: "text/html" } }),
    );

    expect(decision.cacheable).toBe(true);
    expect(decision.reason).toBe("html");
    expect(decision.cacheControl).toBe(HTML_EDGE_CACHE_CONTROL);
    expect(decision.cacheKey?.method).toBe("GET");
    expect(decision.cacheKey?.url).toBe("https://example.com/guides");
  });

  it("assigns the longer HTML cache control to villa detail pages", () => {
    expect(getHtmlEdgeCacheDecision(request("/villas/9"))).toMatchObject({
      cacheControl: VILLA_DETAIL_HTML_EDGE_CACHE_CONTROL,
      cacheable: true,
    });
  });

  it("assigns CMS version groups to each cacheable public HTML route", () => {
    expect(getHtmlEdgeCacheDecision(request("/"))).toMatchObject({
      versionGroups: [
        "site-settings",
        "home-sections",
        "guides",
        "customer-reviews",
        "villa-listings",
      ],
    });
    expect(getHtmlEdgeCacheDecision(request("/search"))).toMatchObject({
      versionGroups: ["site-settings"],
    });
    expect(getHtmlEdgeCacheDecision(request("/guides/family-trip"))).toMatchObject({
      versionGroups: ["site-settings", "guides"],
    });
    expect(getHtmlEdgeCacheDecision(request("/terms"))).toMatchObject({
      versionGroups: ["site-settings", "legal-pages"],
    });
    expect(getHtmlEdgeCacheDecision(request("/villas/9"))).toMatchObject({
      versionGroups: [
        "site-settings",
        "home-sections",
        "detail-layout",
        "villa-details",
        "villa-images",
      ],
    });
  });

  it("includes the CMS version token in the HTML edge cache key", () => {
    const cacheKey = createHtmlEdgeCacheKey(
      request("/guides/family-trip?unused=1#top"),
      "guides:2026",
    );
    const url = new URL(cacheKey!.url);

    expect(cacheKey!.method).toBe("GET");
    expect(url.pathname).toBe("/guides/family-trip");
    expect(url.searchParams.get("__bpv_html_v")).toBe("guides:2026");
    expect(url.hash).toBe("");
  });

  it("adds the Worker deployment version to the HTML cache version token", () => {
    expect(
      createHtmlEdgeVersionToken({
        cmsVersionToken: "guides:2026",
        deploymentVersionToken: "worker-version-1",
      }),
    ).toBe("deploy:worker-version-1|guides:2026");
    expect(
      createHtmlEdgeVersionToken({
        cmsVersionToken: "",
        deploymentVersionToken: "worker-version-1",
      }),
    ).toBe("deploy:worker-version-1");
    expect(
      createHtmlEdgeVersionToken({
        cmsVersionToken: "guides:2026",
        deploymentVersionToken: "",
      }),
    ).toBe("guides:2026");
  });

  it("stores only successful HTML responses without Set-Cookie", () => {
    const response = toHtmlEdgeCacheResponse(
      new Response("<html></html>", {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 200,
      }),
    );

    expect(response).not.toBeNull();
    expect(response?.headers.get("Cache-Control")).toBe(HTML_EDGE_CACHE_CONTROL);

    expect(
      toHtmlEdgeCacheResponse(
        new Response("{}", {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      ),
    ).toBeNull();
    expect(
      toHtmlEdgeCacheResponse(
        new Response("<html></html>", {
          headers: {
            "Content-Type": "text/html",
            "Set-Cookie": "session=1",
          },
          status: 200,
        }),
      ),
    ).toBeNull();
  });

  it("adds diagnostics and browser-safe cache headers to HTML responses", () => {
    const response = withHtmlEdgeCacheHeader(
      new Response("<html></html>", {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 203,
      }),
      "MISS",
    );

    expect(response.status).toBe(203);
    expect(response.headers.get("Cache-Control")).toBe(
      HTML_BROWSER_CACHE_CONTROL,
    );
    expect(response.headers.get(HTML_EDGE_CACHE_HEADER)).toBe("MISS");
  });
});

describe("worker static asset cache policy", () => {
  it("matches only hashed Next static assets", () => {
    expect(isNextStaticAssetPath("/_next/static/chunks/app.js")).toBe(true);
    expect(isNextStaticAssetPath("/_next/static/css/app.css")).toBe(true);

    expect(isNextStaticAssetPath("/_next/image")).toBe(false);
    expect(isNextStaticAssetPath("/api/houses")).toBe(false);
  });

  it("sets long browser cache headers only for successful static assets", () => {
    const cached = withStaticAssetCacheHeaders(
      new Response("asset", { status: 200 }),
    );

    expect(cached.headers.get("Cache-Control")).toBe(
      STATIC_ASSET_CACHE_CONTROL,
    );

    const missing = new Response("not found", { status: 404 });

    expect(withStaticAssetCacheHeaders(missing)).toBe(missing);
  });
});

describe("worker image edge cache policy", () => {
  it("keeps public image proxy responses shared for one year", () => {
    expect(IMAGE_EDGE_CACHE_CONTROL).toBe(
      "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=31536000",
    );
  });

  it("allows only public villa image display proxy requests", () => {
    expect(
      getImageEdgeCacheDecision(
        request("/api/villas/9/images/proxy?url=https%3A%2F%2Fimages.example.com%2Fpool.jpg", {
          headers: { Accept: "image/avif,image/webp,image/*,*/*" },
        }),
      ),
    ).toMatchObject({ cacheable: true, candidate: true, reason: "image" });
    expect(
      getImageEdgeCacheDecision(
        request("/api/villas/9/images?url=https%3A%2F%2Fimages.example.com%2Fpool.jpg", {
          headers: { Accept: "image/avif,image/webp,image/*,*/*" },
        }),
      ),
    ).toMatchObject({ cacheable: true, candidate: true, reason: "image" });
    expect(
      getImageEdgeCacheDecision(
        request("/api/villas/9/images?imageId=7&w=828&q=60", {
          headers: { Accept: "image/avif,image/webp,image/*,*/*" },
        }),
      ),
    ).toMatchObject({ cacheable: true, candidate: true, reason: "image" });
    expect(
      getImageEdgeCacheDecision(
        request("/api/houses/images/proxy?url=https%3A%2F%2Fdevillegroups.com%2Fimgs%2Fprofile_imgs_large%2F501.jpg", {
          headers: { Accept: "image/avif,image/webp,image/*,*/*" },
        }),
      ),
    ).toMatchObject({ cacheable: true, candidate: true, reason: "image" });
    expect(
      getImageEdgeCacheDecision(
        request("/api/houses/images/501?w=640&q=60", {
          headers: { Accept: "image/avif,image/webp,image/*,*/*" },
        }),
      ),
    ).toMatchObject({ cacheable: true, candidate: true, reason: "image" });
    expect(
      getImageEdgeCacheDecision(
        request("/api/site-assets/proxy?url=https%3A%2F%2Fassets.example.com%2Fhero.jpg", {
          headers: { Accept: "image/avif,image/webp,image/*,*/*" },
        }),
      ),
    ).toMatchObject({ cacheable: true, candidate: true, reason: "image" });
    expect(
      getImageEdgeCacheDecision(
        request("/api/guides/images/proxy?url=https%3A%2F%2Fassets.example.com%2Fguide.jpg", {
          headers: { Accept: "image/avif,image/webp,image/*,*/*" },
        }),
      ),
    ).toMatchObject({ cacheable: true, candidate: true, reason: "image" });
    expect(
      getImageEdgeCacheDecision(
        request("/api/tiktok/images/proxy?url=https%3A%2F%2Fp16-sign.tiktokcdn-us.com%2Fcover.jpg%3Fx-expires%3D123%26x-signature%3Dsigned&w=64&q=60", {
          headers: { Accept: "image/avif,image/webp,image/*,*/*" },
        }),
      ),
    ).toMatchObject({ cacheable: true, candidate: true, reason: "image" });
    expect(
      getImageEdgeCacheDecision(
        request("/api/guides/images/family-trip/cover?w=1200&q=75", {
          headers: { Accept: "image/avif,image/webp,image/*,*/*" },
        }),
      ),
    ).toMatchObject({ cacheable: true, candidate: true, reason: "image" });
    expect(
      getImageEdgeCacheDecision(
        request("/api/guides/images/family-trip/content/3?w=1200&q=75", {
          headers: { Accept: "image/avif,image/webp,image/*,*/*" },
        }),
      ),
    ).toMatchObject({ cacheable: true, candidate: true, reason: "image" });

    expect(getImageEdgeCacheDecision(request("/api/villas/9/images"))).toMatchObject({
      cacheable: false,
      candidate: false,
      reason: "path",
    });
    expect(
      getImageEdgeCacheDecision(request("/api/villas/9/images?download=1&url=https://x.test/a.jpg")),
    ).toMatchObject({ cacheable: false, candidate: false, reason: "path" });
    expect(
      getImageEdgeCacheDecision(request("/api/villas/9/images?download=1&imageId=7")),
    ).toMatchObject({ cacheable: false, candidate: false, reason: "path" });
  });

  it("bypasses unsafe image proxy variants", () => {
    expect(getImageEdgeCacheDecision(request("/api/villas/9/images"))).toMatchObject({
      cacheable: false,
      candidate: false,
      reason: "path",
    });
    expect(getImageEdgeCacheDecision(request("/api/villas/9/images/proxy"))).toMatchObject({
      cacheable: false,
      candidate: true,
      reason: "url",
    });
    expect(
      getImageEdgeCacheDecision(
        request("/api/villas/9/images/proxy?url=https://x.test/a.jpg", {
          headers: { Cookie: "session=1" },
        }),
      ),
    ).toMatchObject({ cacheable: false, candidate: true, reason: "cookie" });
    expect(
      getImageEdgeCacheDecision(
        request("/api/villas/9/images/proxy?url=https://x.test/a.jpg", {
          headers: { Accept: "text/html" },
        }),
      ),
    ).toMatchObject({ cacheable: false, candidate: true, reason: "accept" });
  });

  it.each([
    "/api/villas/9/images?imageId=7&debug=1",
    "/api/villas/9/images?imageId=7&imageId=8",
    "/api/villas/9/images?imageId=7&w=828&w=1080",
    "/api/villas/9/images?imageId=7&url=https%3A%2F%2Fx.test%2Fa.jpg",
    "/api/villas/9/images?imageId=0&url=https%3A%2F%2Fx.test%2Fa.jpg",
    "/api/villas/9/images?imageId=7&download=0",
  ])("does not create an image-cache candidate or key for unsupported villa display query %s", (path) => {
    const imageRequest = request(path, {
      headers: { Accept: "image/avif,image/webp,image/*,*/*" },
    });

    expect(getImageEdgeCacheDecision(imageRequest)).toMatchObject({
      cacheable: false,
      candidate: false,
    });
    expect(createImageEdgeCacheKey(imageRequest)).toBeNull();
  });

  it.each([
    "/api/villas/9/images?imageId=7",
    "/api/villas/9/images?imageId=7&w=828&q=60",
    "/api/villas/9/images?url=https%3A%2F%2Fx.test%2Fa.jpg",
    "/api/villas/9/images?url=https%3A%2F%2Fx.test%2Fa.jpg&w=828&q=60",
  ])("creates an image-cache candidate and key for a valid villa display query %s", (path) => {
    const imageRequest = request(path, {
      headers: { Accept: "image/avif,image/webp,image/*,*/*" },
    });

    expect(getImageEdgeCacheDecision(imageRequest)).toMatchObject({
      cacheable: true,
      candidate: true,
      reason: "image",
    });
    expect(createImageEdgeCacheKey(imageRequest)).toBeInstanceOf(Request);
  });

  it("builds an image cache key that keeps only the source URL query and drops hash", () => {
    const cacheKey = createImageEdgeCacheKey(
      request(
        "/api/houses/images/proxy?foo=1&url=https%3A%2F%2Fimages.example.com%2Fpool.jpg%3Fv%3D1&w=640&q=60&bar=2#top",
        { headers: { Accept: "image/avif,image/webp,image/*,*/*" } },
      ),
    );
    const url = new URL(cacheKey!.url);

    expect(cacheKey!.method).toBe("GET");
    expect(url.pathname).toBe("/api/houses/images/proxy");
    expect(url.searchParams.get("url")).toBe("https://images.example.com/pool.jpg?v=1");
    expect(url.searchParams.get("w")).toBe("640");
    expect(url.searchParams.get("q")).toBe("60");
    expect(url.searchParams.get("f")).toBe("avif");
    expect(url.searchParams.has("foo")).toBe(false);
    expect(url.searchParams.has("bar")).toBe(false);
    expect(url.hash).toBe("");
  });

  it("builds an image cache key for resolved image paths without source URL query", () => {
    const cacheKey = createImageEdgeCacheKey(
      request("/api/guides/images/family-trip/cover?w=1200&q=75#top", {
        headers: { Accept: "image/avif,image/webp,image/*,*/*" },
      }),
    );
    const url = new URL(cacheKey!.url);

    expect(cacheKey!.method).toBe("GET");
    expect(url.pathname).toBe("/api/guides/images/family-trip/cover");
    expect(url.searchParams.get("w")).toBe("1200");
    expect(url.searchParams.get("q")).toBe("75");
    expect(url.searchParams.get("f")).toBe("avif");
    expect(url.searchParams.has("url")).toBe(false);
    expect(url.hash).toBe("");
  });

  it("builds an image cache key for villa gallery image-id paths", () => {
    const cacheKey = createImageEdgeCacheKey(
      request("/api/villas/9/images?imageId=7&w=828&q=60#top", {
        headers: { Accept: "image/avif,image/webp,image/*,*/*" },
      }),
    );
    const url = new URL(cacheKey!.url);

    expect(cacheKey!.method).toBe("GET");
    expect(url.pathname).toBe("/api/villas/9/images");
    expect(url.searchParams.get("imageId")).toBe("7");
    expect(url.searchParams.get("w")).toBe("828");
    expect(url.searchParams.get("q")).toBe("60");
    expect(url.searchParams.get("f")).toBe("avif");
    expect(url.searchParams.has("url")).toBe(false);
    expect(url.hash).toBe("");
  });

  it("bypasses unsupported image transform variants before caching", () => {
    expect(
      getImageEdgeCacheDecision(
        request("/api/houses/images/proxy?url=https://x.test/a.jpg&w=999"),
      ),
    ).toMatchObject({ cacheable: false, candidate: true, reason: "transform" });
    expect(
      getImageEdgeCacheDecision(
        request("/api/houses/images/proxy?url=https://x.test/a.jpg&q=90"),
      ),
    ).toMatchObject({ cacheable: false, candidate: true, reason: "transform" });
  });

  it("stores only successful image proxy responses without Set-Cookie", () => {
    const response = toImageEdgeCacheResponse(
      new Response("image bytes", {
        headers: { "Content-Type": "image/webp" },
        status: 200,
      }),
    );

    expect(response).not.toBeNull();
    expect(response?.headers.get("Cache-Control")).toBe(IMAGE_EDGE_CACHE_CONTROL);

    expect(
      toImageEdgeCacheResponse(
        new Response("html", {
          headers: { "Content-Type": "text/html" },
          status: 200,
        }),
      ),
    ).toBeNull();
    expect(
      toImageEdgeCacheResponse(
        new Response("image bytes", {
          headers: {
            "Content-Type": "image/jpeg",
            "Set-Cookie": "session=1",
          },
          status: 200,
        }),
      ),
    ).toBeNull();
  });

  it("adds image cache diagnostics without changing status", () => {
    const response = withImageEdgeCacheHeader(
      new Response("ok", { status: 203 }),
      "HIT",
    );

    expect(response.status).toBe(203);
    expect(response.headers.get(IMAGE_EDGE_CACHE_HEADER)).toBe("HIT");
  });
});

describe("worker booking calendar host access policy", () => {
  it("allows the configured www hostname and its exact apex hostname", () => {
    const path = "/api/villas/9/booking-calendar?month=2026-06";

    expect(
      getBookingCalendarAccessDecision(
        new Request(`https://www.example.com${path}`),
        "https://www.example.com",
      ),
    ).toEqual({ allowed: true, candidate: true, reason: "hostname" });
    expect(
      getBookingCalendarAccessDecision(
        new Request(`https://example.com${path}`),
        "https://www.example.com",
      ),
    ).toEqual({ allowed: true, candidate: true, reason: "hostname" });
    expect(
      getBookingCalendarAccessDecision(
        new Request(`https://cl.example.com${path}`),
        "https://www.example.com",
      ),
    ).toEqual({ allowed: false, candidate: true, reason: "hostname" });
  });

  it.each(["villa-nine", "0", "01", "-1"])(
    "guards a malformed single-segment villa id before it can reach OpenNext: %s",
    (id) => {
      const path = `/api/villas/${id}/booking-calendar?month=2026-06`;

      expect(
        getBookingCalendarAccessDecision(
          new Request(`https://cl.example.com${path}`),
          "https://www.example.com",
        ),
      ).toEqual({ allowed: false, candidate: true, reason: "hostname" });
    },
  );

  it("does not classify a multi-segment path as the booking-calendar route", () => {
    expect(
      getBookingCalendarAccessDecision(
        new Request(
          "https://www.example.com/api/villas/foo/bar/booking-calendar",
        ),
        "https://www.example.com",
      ),
    ).toEqual({ allowed: true, candidate: false, reason: "path" });
  });

  it("does not guard the removed booking calendar token endpoint", () => {
    const removedPath = [
      "/api/villas/9/booking-calendar",
      "token",
    ].join("-");

    expect(
      getBookingCalendarAccessDecision(
        new Request(`https://www.example.com${removedPath}`),
        "https://www.example.com",
      ),
    ).toEqual({ allowed: true, candidate: false, reason: "path" });
  });

  it("fails closed when the configured public site URL is invalid", () => {
    expect(
      getBookingCalendarAccessDecision(
        request("/api/villas/9/booking-calendar?month=2026-06"),
        "not-a-url",
      ),
    ).toEqual({ allowed: false, candidate: true, reason: "config" });
  });

  it("fails closed when the configured public site URL is not HTTPS", () => {
    expect(
      getBookingCalendarAccessDecision(
        request("/api/villas/9/booking-calendar?month=2026-06"),
        "http://www.example.com",
      ),
    ).toEqual({ allowed: false, candidate: true, reason: "config" });
  });

  it("allows only the exact configured direct workers.dev hostname", () => {
    const path = "/api/villas/9/booking-calendar?month=2026-06";
    const configuredHost =
      "baan-pool-villa-staging.chaymanus2003.workers.dev";

    expect(
      getBookingCalendarAccessDecision(
        new Request(`https://${configuredHost}${path}`),
        `https://${configuredHost}`,
      ),
    ).toEqual({ allowed: true, candidate: true, reason: "hostname" });
    expect(
      getBookingCalendarAccessDecision(
        new Request(
          `https://other-worker.chaymanus2003.workers.dev${path}`,
        ),
        `https://${configuredHost}`,
      ),
    ).toEqual({ allowed: false, candidate: true, reason: "hostname" });
  });

  it.each([
    "preview.baan-pool-villa-staging.chaymanus2003.workers.dev",
    "chaymanus2003.workers.dev",
  ])(
    "fails closed for an invalid direct workers.dev configuration: %s",
    (configuredHost) => {
      const path = "/api/villas/9/booking-calendar?month=2026-06";

      expect(
        getBookingCalendarAccessDecision(
          new Request(`https://${configuredHost}${path}`),
          `https://${configuredHost}`,
        ),
      ).toEqual({ allowed: false, candidate: true, reason: "config" });
    },
  );

  it("fails closed when a direct workers.dev configuration is not HTTPS", () => {
    const host = "baan-pool-villa-staging.chaymanus2003.workers.dev";

    expect(
      getBookingCalendarAccessDecision(
        new Request(
          `https://${host}/api/villas/9/booking-calendar?month=2026-06`,
        ),
        `http://${host}`,
      ),
    ).toEqual({ allowed: false, candidate: true, reason: "config" });
  });

  it("rejects HTTP requests on an otherwise official hostname", () => {
    expect(
      getBookingCalendarAccessDecision(
        new Request(
          "http://www.example.com/api/villas/9/booking-calendar?month=2026-06",
        ),
        "https://www.example.com",
      ),
    ).toEqual({ allowed: false, candidate: true, reason: "protocol" });
  });

  it("does not guard unrelated paths", () => {
    expect(
      getBookingCalendarAccessDecision(
        request("/api/villas/9"),
        "https://www.example.com",
      ),
    ).toEqual({ allowed: true, candidate: false, reason: "path" });
  });
});

describe("worker JSON edge cache policy", () => {
  it("keeps the public house catalog JSON cache shared for six hours", () => {
    expect(HOUSE_JSON_EDGE_CACHE_CONTROL).toBe(
      "public, s-maxage=21600, stale-while-revalidate=21600",
    );
  });

  it("allows the bounded public JSON API batch", () => {
    expect(getJsonEdgeCacheDecision(request("/api/houses"))).toMatchObject({
      cacheControl: HOUSE_JSON_EDGE_CACHE_CONTROL,
      cacheable: true,
      candidate: true,
      reason: "json",
      versionGroups: ["villa-listings"],
    });
    expect(getJsonEdgeCacheDecision(request("/api/home-sections"))).toMatchObject({
      cacheControl: JSON_EDGE_CACHE_CONTROL,
      cacheable: true,
      candidate: true,
      reason: "json",
      versionGroups: ["home-sections"],
    });
    expect(getJsonEdgeCacheDecision(request("/api/home-deferred"))).toMatchObject({
      cacheControl: JSON_EDGE_CACHE_CONTROL,
      cacheable: true,
      candidate: true,
      reason: "json",
      versionGroups: [
        "home-sections",
        "guides",
        "customer-reviews",
        "villa-listings",
      ],
    });
    expect(
      getJsonEdgeCacheDecision(
        request("/api/home-deferred?criticalRail=featured-villas"),
      ),
    ).toMatchObject({
      cacheControl: JSON_EDGE_CACHE_CONTROL,
      cacheable: true,
      candidate: true,
      reason: "json",
    });
    expect(
      getJsonEdgeCacheDecision(
        request("/api/home-rail?rail=featured-villas&offset=4&exclude=1&exclude=2&exclude=3&exclude=4"),
      ),
    ).toMatchObject({
      cacheControl: JSON_EDGE_CACHE_CONTROL,
      cacheable: true,
      candidate: true,
      reason: "json",
      versionGroups: ["home-sections", "villa-listings"],
    });
    expect(getJsonEdgeCacheDecision(request("/api/villas/9"))).toMatchObject({
      cacheable: true,
      candidate: true,
      reason: "json",
      versionGroups: ["villa-details"],
    });
    expect(
      getJsonEdgeCacheDecision(
        request("/api/villas/9/booking-calendar?month=2026-06"),
      ),
    ).toMatchObject({
      cacheable: false,
      candidate: false,
      reason: "path",
    });
    expect(getJsonEdgeCacheDecision(request("/api/villas/9/images"))).toMatchObject({
      cacheable: false,
      candidate: false,
      reason: "path",
    });
    expect(
      getJsonEdgeCacheDecision(request("/api/villas/9/images?view=card")),
    ).toMatchObject({
      cacheable: true,
      candidate: true,
      reason: "json",
      versionGroups: ["villa-images"],
    });

    expect(getJsonEdgeCacheDecision(request("/api/admin/site-settings"))).toMatchObject({
      cacheable: false,
      candidate: false,
      reason: "path",
    });
    expect(getJsonEdgeCacheDecision(request("/api/villas/9/images/proxy?url=https://x.test/a.jpg"))).toMatchObject({
      cacheable: false,
      candidate: false,
      reason: "path",
    });
  });

  it("bypasses JSON variants that should not be shared", () => {
    expect(getJsonEdgeCacheDecision(request("/api/houses?zone=jomtien"))).toMatchObject({
      cacheable: false,
      candidate: true,
      reason: "query",
    });
    expect(
      getJsonEdgeCacheDecision(
        request("/api/home-deferred?criticalRail=featured&debug=1"),
      ),
    ).toMatchObject({ cacheable: false, candidate: true, reason: "query" });
    expect(
      getJsonEdgeCacheDecision(
        request("/api/home-deferred?criticalRail=featured&criticalRail=later"),
      ),
    ).toMatchObject({ cacheable: false, candidate: true, reason: "query" });
    expect(
      getJsonEdgeCacheDecision(
        request("/api/home-rail?rail=featured&offset=5"),
      ),
    ).toMatchObject({ cacheable: false, candidate: true, reason: "query" });
    expect(
      getJsonEdgeCacheDecision(
        request("/api/home-rail?rail=featured&offset=4&exclude=1&exclude=1"),
      ),
    ).toMatchObject({ cacheable: false, candidate: true, reason: "query" });
    expect(
      getJsonEdgeCacheDecision(
        request("/api/home-rail?rail=featured&offset=4&exclude=0"),
      ),
    ).toMatchObject({ cacheable: false, candidate: true, reason: "query" });
    expect(
      getJsonEdgeCacheDecision(
        request(
          "/api/home-rail?rail=featured&offset=4&exclude=1&exclude=2&exclude=3&exclude=4&exclude=5",
        ),
      ),
    ).toMatchObject({ cacheable: false, candidate: true, reason: "query" });
    expect(
      getJsonEdgeCacheDecision(request("/api/villas/9/images?imageId=7")),
    ).toMatchObject({ cacheable: false, candidate: false, reason: "path" });
    expect(
      getJsonEdgeCacheDecision(request("/api/villas/9/images?view=card&page=home")),
    ).toMatchObject({ cacheable: false, candidate: false, reason: "path" });
    expect(
      getJsonEdgeCacheDecision(request("/api/villas/9/images?view=card&debug=1")),
    ).toMatchObject({ cacheable: false, candidate: false, reason: "path" });
    expect(
      getJsonEdgeCacheDecision(
        request("/api/villas/9/images?view=card&view=card"),
      ),
    ).toMatchObject({ cacheable: false, candidate: false, reason: "path" });
    expect(
      getJsonEdgeCacheDecision(
        request("/api/houses", { headers: { Cookie: "session=1" } }),
      ),
    ).toMatchObject({ cacheable: false, candidate: true, reason: "cookie" });
    expect(
      getJsonEdgeCacheDecision(
        request("/api/houses", { headers: { Accept: "text/html" } }),
      ),
    ).toMatchObject({ cacheable: false, candidate: true, reason: "accept" });
    expect(getJsonEdgeCacheDecision(request("/api/houses", { method: "POST" }))).toMatchObject({
      cacheable: false,
      candidate: true,
      reason: "method",
    });
  });

  it("includes the JSON version token in cache keys only when provided", () => {
    const cacheKey = createJsonEdgeCacheKey(
      request("/api/home-sections#top"),
      "home-sections:42",
    );
    const url = new URL(cacheKey.url);

    expect(cacheKey.method).toBe("GET");
    expect(url.pathname).toBe("/api/home-sections");
    expect(url.searchParams.get("__bpv_json_v")).toBe("home-sections:42");
    expect(url.hash).toBe("");
  });

  it("keeps the document critical rail in deferred-home JSON cache keys", () => {
    const cacheKey = createJsonEdgeCacheKey(
      request("/api/home-deferred?criticalRail=featured-villas#later"),
      "home-sections:42",
    );
    const url = new URL(cacheKey.url);

    expect(url.pathname).toBe("/api/home-deferred");
    expect(url.searchParams.get("criticalRail")).toBe("featured-villas");
    expect(url.searchParams.get("__bpv_json_v")).toBe("home-sections:42");
    expect(url.hash).toBe("");
  });

  it("keeps the rail identity and offset in continuation JSON cache keys", () => {
    const cacheKey = createJsonEdgeCacheKey(
      request("/api/home-rail?rail=featured-villas&offset=8&exclude=1&exclude=2&exclude=4#later"),
      "home-sections:42",
    );
    const url = new URL(cacheKey.url);

    expect(url.pathname).toBe("/api/home-rail");
    expect(url.searchParams.get("rail")).toBe("featured-villas");
    expect(url.searchParams.get("offset")).toBe("8");
    expect(url.searchParams.getAll("exclude")).toEqual(["1", "2", "4"]);
    expect(url.searchParams.get("__bpv_json_v")).toBe("home-sections:42");
    expect(url.hash).toBe("");
  });

  it("drops booking calendar query values from generic JSON cache keys", () => {
    const cacheKey = createJsonEdgeCacheKey(
      request(
        "/api/villas/9/booking-calendar?month=2026-06&months=6#top",
      ),
      "villa-details:42",
    );
    const url = new URL(cacheKey.url);

    expect(cacheKey.method).toBe("GET");
    expect(url.pathname).toBe("/api/villas/9/booking-calendar");
    expect(url.searchParams.has("month")).toBe(false);
    expect(url.searchParams.has("months")).toBe(false);
    expect(url.searchParams.get("__bpv_json_v")).toBe("villa-details:42");
    expect(url.hash).toBe("");
  });

  it("keeps the villa card view in JSON cache keys", () => {
    const cacheKey = createJsonEdgeCacheKey(
      request("/api/villas/9/images?view=card#top"),
      "villa-images:42",
    );
    const url = new URL(cacheKey.url);

    expect(cacheKey.method).toBe("GET");
    expect(url.pathname).toBe("/api/villas/9/images");
    expect(url.searchParams.get("view")).toBe("card");
    expect(url.searchParams.has("page")).toBe(false);
    expect(url.searchParams.get("__bpv_json_v")).toBe("villa-images:42");
    expect(url.hash).toBe("");
  });

  it("stores only successful JSON responses without Set-Cookie", () => {
    const response = toJsonEdgeCacheResponse(
      Response.json({ ok: true }, { status: 200 }),
    );

    expect(response).not.toBeNull();
    expect(response?.headers.get("Cache-Control")).toBe(JSON_EDGE_CACHE_CONTROL);

    expect(
      toJsonEdgeCacheResponse(
        new Response("<html></html>", {
          headers: { "Content-Type": "text/html" },
          status: 200,
        }),
      ),
    ).toBeNull();
    expect(
      toJsonEdgeCacheResponse(
        Response.json(
          { ok: true },
          {
            headers: { "Set-Cookie": "session=1" },
            status: 200,
          },
        ),
      ),
    ).toBeNull();
  });

  it("adds JSON cache diagnostics without changing status", () => {
    const response = withJsonEdgeCacheHeader(
      new Response("ok", { status: 203 }),
      "MISS",
    );

    expect(response.status).toBe(203);
    expect(response.headers.get(JSON_EDGE_CACHE_HEADER)).toBe("MISS");
  });
});
