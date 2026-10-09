import { afterEach, describe, expect, it, vi } from "vitest";

import { loadTikTokClientOEmbed } from "../tiktok-client-oembed";

describe("loadTikTokClientOEmbed", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not extend stored metadata expiry when promoting it to memory", async () => {
    vi.useFakeTimers();
    const now = Date.now();
    const getItem = vi.fn(() => JSON.stringify({
      expiresAt: now + 1_000,
      thumbnailUrl: "https://p16-sign.tiktokcdn-us.com/expiring.jpg",
    }));
    vi.stubGlobal("localStorage", { getItem, removeItem: vi.fn(), setItem: vi.fn() });
    const fetcher = vi.fn(async () => Response.json(null));
    const url = "https://www.tiktok.com/@baanpoolvilla/video/7647091019053583690";

    expect(await loadTikTokClientOEmbed(url, undefined, fetcher)).not.toBeNull();
    vi.setSystemTime(now + 1_001);
    expect(await loadTikTokClientOEmbed(url, undefined, fetcher)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("expires successful client metadata after twelve hours", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => Response.json({
      thumbnail_url: "https://p16-sign.tiktokcdn-us.com/ttl.jpg",
    }));
    const url = "https://www.tiktok.com/@baanpoolvilla/video/7647091019053583691";
    await loadTikTokClientOEmbed(url, undefined, fetcher);
    vi.setSystemTime(Date.now() + 43_200_001);
    await loadTikTokClientOEmbed(url, undefined, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("loads safe TikTok thumbnail metadata through the same-origin API", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe(
        "/api/tiktok/oembed?url=https%3A%2F%2Fwww.tiktok.com%2F%40baanpoolvilla%2Fvideo%2F7647091019053583624",
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

  it("retries a rate-limited metadata request before falling back", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(Response.json({
        thumbnail_url: "https://p16-sign.tiktokcdn-us.com/recovered.jpeg",
      }));

    await expect(
      loadTikTokClientOEmbed(
        "https://www.tiktok.com/@baanpoolvilla/video/7647091019053583629",
        undefined,
        fetcher,
      ),
    ).resolves.toMatchObject({
      thumbnailUrl: "https://p16-sign.tiktokcdn-us.com/recovered.jpeg",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
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
