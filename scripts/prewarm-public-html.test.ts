import { describe, expect, it, vi } from "vitest";

import {
  collectPrewarmPaths,
  parseSitemapLocations,
  prewarmPublicHtml,
  resolvePrewarmBaseUrl,
} from "./prewarm-public-html.mjs";

const BASE_URL = "https://baan-pool-villa.nutthawutprayoonklay.workers.dev";

function textResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, {
    status: 200,
    ...init,
  });
}

describe("public HTML prewarm", () => {
  it("requires a configured base URL", () => {
    expect(
      resolvePrewarmBaseUrl({
        BPV_PREWARM_BASE_URL: "https://www.baanpoolvilla.example",
      }),
    ).toBe("https://www.baanpoolvilla.example");
    expect(
      resolvePrewarmBaseUrl({
        NEXT_PUBLIC_SITE_URL: "https://public.example",
      }),
    ).toBe("https://public.example");
    expect(resolvePrewarmBaseUrl({}, "https://cli.example")).toBe(
      "https://cli.example",
    );
    expect(() => {
      resolvePrewarmBaseUrl({});
    }).toThrow("Missing prewarm base URL");
  });

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

  it("returns fixed public pages when sitemap loading times out", async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      init?.signal?.dispatchEvent(new Event("abort"));

      return new Promise<Response>(() => undefined);
    });

    await expect(
      collectPrewarmPaths({
        baseUrl: BASE_URL,
        fetchImpl,
        fetchTimeoutMs: 1,
      }),
    ).resolves.toEqual(["/", "/search", "/guides", "/terms", "/privacy"]);
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

  it("marks page fetch timeouts as failed instead of hanging", async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      init?.signal?.dispatchEvent(new Event("abort"));

      return new Promise<Response>(() => undefined);
    });

    const summary = await prewarmPublicHtml({
      baseUrl: BASE_URL,
      fetchImpl,
      fetchTimeoutMs: 1,
      paths: ["/"],
    });

    expect(summary).toMatchObject({
      failed: 1,
      requested: 1,
    });
  });

  it("collects paths when callers omit the paths argument", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        textResponse(`
          <urlset>
            <url><loc>${BASE_URL}/villas/9</loc></url>
          </urlset>
        `),
      )
      .mockResolvedValue(
        textResponse("<html></html>", {
          headers: { "x-bpv-html-cache": "HIT" },
        }),
      );

    const summary = await prewarmPublicHtml({
      baseUrl: BASE_URL,
      fetchImpl,
      maxDynamicRoutes: 1,
    });

    expect(summary.requested).toBe(6);
    expect(summary.failed).toBe(0);
    expect(fetchImpl).toHaveBeenCalledWith(
      `${BASE_URL}/sitemap.xml`,
      expect.objectContaining({
        method: "GET",
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
