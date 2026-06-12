import { describe, expect, it } from "vitest";

import {
  HTML_EDGE_CACHE_CONTROL,
  HTML_EDGE_CACHE_HEADER,
  getHtmlEdgeCacheDecision,
  isPublicHtmlCachePath,
  toHtmlEdgeCacheResponse,
  withHtmlEdgeCacheHeader,
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
    expect(isPublicHtmlCachePath("/villas/9")).toBe(false);
    expect(isPublicHtmlCachePath("/guides/family-trip/extra")).toBe(false);
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
