import { AsyncLocalStorage } from "node:async_hooks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const video = "https://www.tiktok.com/@baanpool/video/7474970557352578309";
const thumbnail = "https://p16-sign.tiktokcdn-us.com/cover.jpg?x-signature=signed";
const muscdnThumbnail = "https://p16.muscdn.com/obj/tos-maliva-p-0068/cover.jpg";
const cacheWrite = vi.fn();

// Keep Next's real cache wrapper; replace only its persistent backing store.
beforeEach(() => {
  vi.stubGlobal("AsyncLocalStorage", AsyncLocalStorage);
  const entries = new Map<string, unknown>();
  cacheWrite.mockReset().mockImplementation(async (key: string, value: unknown) => {
    entries.set(key, value);
  });
  vi.stubGlobal("__incrementalCache", {
    generateSimpleCacheKey: async (key: string) => key,
    get: async (key: string) => entries.has(key) ? { value: entries.get(key), isStale: false } : null,
    set: cacheWrite,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function request(query: string) {
  const { GET } = await import("../../../app/(public)/api/tiktok/oembed/route");
  return GET(new Request(`https://example.test/api/tiktok/oembed?${query}`));
}

describe("GET /api/tiktok/oembed", () => {
  it("fetches canonical TikTok metadata with a twelve-hour cache and excludes embed HTML", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({
      author_name: " @baanpool ", title: " Pool villa ", thumbnail_url: thumbnail,
      html: "<script>untrusted</script>",
    }));
    vi.stubGlobal("fetch", fetcher);
    const response = await request(new URLSearchParams({ url: `${video}?sender_device=pc#tracking` }).toString());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, s-maxage=43200");
    await expect(response.json()).resolves.toEqual({
      author_name: "@baanpool", title: "Pool villa", thumbnail_url: thumbnail,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cacheWrite).toHaveBeenCalledWith(expect.any(String),
      expect.objectContaining({ revalidate: 43200 }),
      expect.objectContaining({ tags: ["tiktok-oembed"] }),
    );
    expect(fetcher).toHaveBeenCalledWith(
      `https://www.tiktok.com/oembed?${new URLSearchParams({ url: video })}`,
      expect.objectContaining({
        cache: "no-store", redirect: "error", signal: expect.any(AbortSignal),
      }),
    );
  });

  it("returns a TikTok thumbnail served from the official muscdn host", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      thumbnail_url: muscdnThumbnail,
    })));

    const response = await request(new URLSearchParams({ url: video }).toString());

    await expect(response.json()).resolves.toEqual({
      author_name: "",
      thumbnail_url: muscdnThumbnail,
      title: "",
    });
  });

  it("recovers after invalid HTTP 200 metadata and caches only the validated result", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("<html>temporary upstream error</html>"))
      .mockResolvedValueOnce(Response.json({ thumbnail_url: thumbnail, title: "Recovered" }));
    vi.stubGlobal("fetch", fetcher);
    const query = new URLSearchParams({ url: video }).toString();
    await expect((await request(query)).json()).resolves.toBeNull();
    await expect((await request(query)).json()).resolves.toMatchObject({ title: "Recovered" });
    await expect((await request(query)).json()).resolves.toMatchObject({ title: "Recovered" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("returns a retryable status when TikTok rate-limits the metadata request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rate limited", {
      headers: { "Retry-After": "1" },
      status: 429,
    })));

    const response = await request(new URLSearchParams({ url: video }).toString());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("1");
    await expect(response.json()).resolves.toEqual({
      error: "TikTok metadata is temporarily unavailable.",
    });
    expect(cacheWrite).not.toHaveBeenCalled();
  });

  it.each([
    "", "url=", "url=not-a-url", "url=https://evil.test/video/7474970557352578309",
    `url=${encodeURIComponent(video.replace("www.tiktok.com", "www.tiktok.com.evil.test"))}`,
    `url=${encodeURIComponent(video.replace("https:", "http:"))}`,
    `url=${encodeURIComponent(video.replace("https://", "https://user:pass@"))}`,
    `url=${encodeURIComponent(video.replace(".com/", ".com:444/"))}`,
    "url=https://www.tiktok.com/@baanpool", "url=https://127.0.0.1/",
    `url=${encodeURIComponent(video)}&url=${encodeURIComponent(video)}`,
    `url=${encodeURIComponent(video)}&extra=1`, `url=${"x".repeat(2049)}`,
  ])("rejects invalid or ambiguous input without fetching: %s", async (query) => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const response = await request(query);
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    () => new Response("unavailable", { status: 503 }),
    () => new Response("<html>not JSON</html>"),
    () => Response.json(null),
    () => Response.json({ thumbnail_url: "https://evil.test/cover.jpg" }),
    () => Response.json({ thumbnail_url: "http://p16-sign.tiktokcdn-us.com/cover.jpg" }),
    () => Response.json({ thumbnail_url: thumbnail.replace(".com/", ".com.evil.test/") }),
    () => { throw new DOMException("Timed out", "TimeoutError"); },
  ])("returns a non-cached fallback when TikTok metadata is unavailable or unsafe (%#)", async (result) => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(result));
    const response = await request(new URLSearchParams({ url: video }).toString());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(cacheWrite).not.toHaveBeenCalled();
  });
});
