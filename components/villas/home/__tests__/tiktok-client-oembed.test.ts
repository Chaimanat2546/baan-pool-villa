import { afterEach, describe, expect, it, vi } from "vitest";

import { loadTikTokClientOEmbed } from "../tiktok-client-oembed";

describe("loadTikTokClientOEmbed", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads safe TikTok thumbnail metadata from the public oEmbed endpoint", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe(
        "https://www.tiktok.com/oembed?url=https%3A%2F%2Fwww.tiktok.com%2F%40baanpoolvilla%2Fvideo%2F7647091019053583624",
      );
      expect(init?.signal).toBeInstanceOf(AbortSignal);

      return Response.json({
        author_name: "@baanpoolvilla",
        thumbnail_url: "https://p16-sign.tiktokcdn-us.com/cover.jpeg",
        title: "Pool villa clip",
      });
    });
    const controller = new AbortController();

    await expect(
      loadTikTokClientOEmbed(
        "https://www.tiktok.com/@baanpoolvilla/video/7647091019053583624",
        controller.signal,
        fetcher,
      ),
    ).resolves.toEqual({
      authorName: "@baanpoolvilla",
      thumbnailUrl: "https://p16-sign.tiktokcdn-us.com/cover.jpeg",
      title: "Pool villa clip",
    });
  });

  it("returns null when oEmbed fails or returns an unsafe thumbnail", async () => {
    const unsafeFetcher = vi.fn(async () =>
      Response.json({ thumbnail_url: "http://example.com/cover.jpg" }),
    );
    const failedFetcher = vi.fn(async () => new Response("blocked", { status: 403 }));

    await expect(
      loadTikTokClientOEmbed(
        "https://www.tiktok.com/@baanpoolvilla/video/7647091019053583627",
        undefined,
        unsafeFetcher,
      ),
    ).resolves.toBeNull();
    await expect(
      loadTikTokClientOEmbed(
        "https://www.tiktok.com/@baanpoolvilla/video/7647091019053583628",
        undefined,
        failedFetcher,
      ),
    ).resolves.toBeNull();
  });

  it("reuses in-memory metadata for the same video URL", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        thumbnail_url: "https://p16-sign.tiktokcdn-us.com/memory-cover.jpeg",
      }),
    );
    const videoUrl =
      "https://www.tiktok.com/@baanpoolvilla/video/7647091019053583625";

    await expect(loadTikTokClientOEmbed(videoUrl, undefined, fetcher)).resolves.toMatchObject({
      thumbnailUrl: "https://p16-sign.tiktokcdn-us.com/memory-cover.jpeg",
    });
    await expect(loadTikTokClientOEmbed(videoUrl, undefined, fetcher)).resolves.toMatchObject({
      thumbnailUrl: "https://p16-sign.tiktokcdn-us.com/memory-cover.jpeg",
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("loads fresh metadata from localStorage without fetching", async () => {
    const getItem = vi.fn(() =>
      JSON.stringify({
        authorName: "@cached",
        expiresAt: Date.now() + 60_000,
        thumbnailUrl: "https://p16-sign.tiktokcdn-us.com/storage-cover.jpeg",
        title: "Cached clip",
      }),
    );
    vi.stubGlobal("localStorage", {
      getItem,
      removeItem: vi.fn(),
      setItem: vi.fn(),
    });
    const fetcher = vi.fn();

    await expect(
      loadTikTokClientOEmbed(
        "https://www.tiktok.com/@baanpoolvilla/video/7647091019053583626",
        undefined,
        fetcher as typeof fetch,
      ),
    ).resolves.toEqual({
      authorName: "@cached",
      thumbnailUrl: "https://p16-sign.tiktokcdn-us.com/storage-cover.jpeg",
      title: "Cached clip",
    });

    expect(getItem).toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
