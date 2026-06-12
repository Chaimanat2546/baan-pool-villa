import { describe, expect, it } from "vitest";

import {
  HTML_EDGE_CACHE_CONTROL,
  HTML_EDGE_CACHE_HEADER,
  IMAGE_EDGE_CACHE_CONTROL,
  IMAGE_EDGE_CACHE_HEADER,
  JSON_EDGE_CACHE_CONTROL,
  JSON_EDGE_CACHE_HEADER,
  createHtmlEdgeCacheKey,
  createHtmlEdgeVersionToken,
  createImageEdgeCacheKey,
  createJsonEdgeCacheKey,
  getHtmlEdgeCacheDecision,
  getImageEdgeCacheDecision,
  getJsonEdgeCacheDecision,
  isPublicHtmlCachePath,
  toHtmlEdgeCacheResponse,
  toImageEdgeCacheResponse,
  toJsonEdgeCacheResponse,
  withHtmlEdgeCacheHeader,
  withImageEdgeCacheHeader,
  withJsonEdgeCacheHeader,
} from "./worker-cache-policy.js";

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://example.com${path}`, {
    method: "GET",
    ...init,
  });
}

describe("worker HTML edge cache policy", () => {
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
    expect(decision.cacheKey?.method).toBe("GET");
    expect(decision.cacheKey?.url).toBe("https://example.com/guides");
  });

  it("assigns CMS version groups to each cacheable public HTML route", () => {
    expect(getHtmlEdgeCacheDecision(request("/"))).toMatchObject({
      versionGroups: ["site-settings", "home-sections", "guides"],
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
      versionGroups: ["site-settings", "home-sections", "detail-layout"],
    });
  });

  it("includes the CMS version token in the HTML edge cache key", () => {
    const cacheKey = createHtmlEdgeCacheKey(
      request("/guides/family-trip?unused=1#top"),
      "guides:2026",
    );
    const url = new URL(cacheKey.url);

    expect(cacheKey.method).toBe("GET");
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

  it("adds a diagnostic cache header without changing the status", () => {
    const response = withHtmlEdgeCacheHeader(
      new Response("ok", { status: 203 }),
      "MISS",
    );

    expect(response.status).toBe(203);
    expect(response.headers.get(HTML_EDGE_CACHE_HEADER)).toBe("MISS");
  });
});

describe("worker image edge cache policy", () => {
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
        request("/api/houses/images/proxy?url=https%3A%2F%2Fdevillegroups.com%2Fimgs%2Fprofile_imgs_large%2F501.jpg", {
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

    expect(getImageEdgeCacheDecision(request("/api/villas/9/images"))).toMatchObject({
      cacheable: false,
      candidate: false,
      reason: "path",
    });
    expect(
      getImageEdgeCacheDecision(request("/api/villas/9/images/download?url=https://x.test/a.jpg")),
    ).toMatchObject({ cacheable: false, candidate: false, reason: "path" });
  });

  it("bypasses unsafe image proxy variants", () => {
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

  it("builds an image cache key that keeps only the source URL query and drops hash", () => {
    const cacheKey = createImageEdgeCacheKey(
      request(
        "/api/houses/images/proxy?foo=1&url=https%3A%2F%2Fimages.example.com%2Fpool.jpg%3Fv%3D1&bar=2#top",
      ),
    );
    const url = new URL(cacheKey.url);

    expect(cacheKey.method).toBe("GET");
    expect(url.pathname).toBe("/api/houses/images/proxy");
    expect(url.searchParams.get("url")).toBe("https://images.example.com/pool.jpg?v=1");
    expect(url.searchParams.has("foo")).toBe(false);
    expect(url.searchParams.has("bar")).toBe(false);
    expect(url.hash).toBe("");
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

describe("worker JSON edge cache policy", () => {
  it("allows the bounded public JSON API batch", () => {
    expect(getJsonEdgeCacheDecision(request("/api/houses"))).toMatchObject({
      cacheable: true,
      candidate: true,
      reason: "json",
      versionGroups: ["villa-listings"],
    });
    expect(getJsonEdgeCacheDecision(request("/api/home-sections"))).toMatchObject({
      cacheable: true,
      candidate: true,
      reason: "json",
      versionGroups: ["home-sections"],
    });
    expect(getJsonEdgeCacheDecision(request("/api/villas/9"))).toMatchObject({
      cacheable: true,
      candidate: true,
      reason: "json",
      versionGroups: ["villa-details"],
    });
    expect(getJsonEdgeCacheDecision(request("/api/villas/9/images"))).toMatchObject({
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
