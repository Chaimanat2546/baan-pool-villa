import { describe, expect, it, vi } from "vitest";

import {
  collectPrewarmPaths,
  parseSitemapLocations,
  prewarmPublicHtml,
} from "./prewarm-public-html.mjs";

const BASE_URL = "https://baan-pool-villa.nutthawutprayoonklay.workers.dev";

function textResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, {
    status: 200,
    ...init,
  });
}

describe("public HTML prewarm", () => {
  it("extracts sitemap loc values without trusting comments or escaped markup", () => {
    expect(
      parseSitemapLocations(`
        <urlset>
          <!-- <loc>https://example.com/admin</loc> -->
          <url><loc>https://example.com/</loc></url>
          <url><loc>https://example.com/guides/family-pool-villa</loc></url>
        </urlset>
      `),
    ).toEqual([
      "https://example.com/",
      "https://example.com/guides/family-pool-villa",
    ]);
  });

  it("keeps only bounded public HTML paths from the sitemap", async () => {
    const fetchImpl = vi.fn(async () =>
      textResponse(`
        <urlset>
          <url><loc>${BASE_URL}/villas/9</loc></url>
          <url><loc>${BASE_URL}/villas/10</loc></url>
          <url><loc>${BASE_URL}/guides/family-pool-villa</loc></url>
          <url><loc>${BASE_URL}/guides/family-pool-villa/extra</loc></url>
          <url><loc>${BASE_URL}/search?guests=10</loc></url>
          <url><loc>${BASE_URL}/api/houses</loc></url>
          <url><loc>${BASE_URL}/_next/static/chunks/app.js</loc></url>
          <url><loc>${BASE_URL}/admin/login</loc></url>
        </urlset>
      `),
    );

    await expect(
      collectPrewarmPaths({
        baseUrl: BASE_URL,
        fetchImpl,
        maxDynamicRoutes: 2,
      }),
    ).resolves.toEqual([
      "/",
      "/search",
      "/guides",
      "/terms",
      "/privacy",
      "/villas/9",
      "/villas/10",
    ]);
  });

  it("warms MISS responses with a follow-up HIT verification request", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        textResponse("<html></html>", {
          headers: { "x-bpv-html-cache": "MISS" },
        }),
      )
      .mockResolvedValueOnce(
        textResponse("<html></html>", {
          headers: { "x-bpv-html-cache": "HIT" },
        }),
      );
    const wait = vi.fn(async () => undefined);

    const summary = await prewarmPublicHtml({
      baseUrl: BASE_URL,
      fetchImpl,
      paths: ["/"],
      wait,
    });

    expect(summary).toMatchObject({
      bypassed: 0,
      failed: 0,
      hit: 1,
      miss: 1,
      requested: 1,
      verifiedHit: 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][0]).toBe(`${BASE_URL}/`);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "baan-pool-villa-cache-prewarm/1.0",
      },
      method: "GET",
    });
  });
});
