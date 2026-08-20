import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/tiktok/images/proxy", () => {
  it("applies an allowlisted transform to a signed TikTok CDN thumbnail", async () => {
    const source =
      "https://p16-sign.tiktokcdn-us.com/tos-useast5-p-0068-tx/no-extension?x-expires=123&x-signature=signed";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("thumbnail bytes", {
        headers: { "Content-Type": "image/webp" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import(
      "../../../app/(public)/api/tiktok/images/proxy/route"
    );
    const params = new URLSearchParams({ q: "60", url: source, w: "64" });

    const response = await GET(
      new Request(`https://example.com/api/tiktok/images/proxy?${params}`, {
        headers: { Accept: "image/webp,image/*,*/*" },
      }),
    );

    await expect(response.text()).resolves.toBe("thumbnail bytes");
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(source, {
      cache: "no-store",
      cf: {
        image: {
          fit: "scale-down",
          format: "webp",
          quality: 60,
          width: 64,
        },
      },
      redirect: "manual",
      signal: expect.any(AbortSignal),
    });
  });

  it("rejects non-TikTok and lookalike hosts before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import(
      "../../../app/(public)/api/tiktok/images/proxy/route"
    );

    for (const source of [
      "https://assets.example.com/cover.jpg",
      "https://p16-sign.tiktokcdn-us.com.evil.test/cover.jpg",
    ]) {
      const params = new URLSearchParams({ q: "60", url: source, w: "64" });
      const response = await GET(
        new Request(`https://example.com/api/tiktok/images/proxy?${params}`),
      );

      await expect(response.json()).resolves.toEqual({ error: "Image not found" });
      expect(response.status).toBe(404);
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
