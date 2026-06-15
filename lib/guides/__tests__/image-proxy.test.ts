import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GuidePost } from "@/lib/guides/types";

vi.mock("server-only", () => ({}));

const { getPublishedGuidesMock } = vi.hoisted(() => ({
  getPublishedGuidesMock: vi.fn(),
}));

vi.mock("@/lib/guides/server", () => ({
  getPublishedGuides: getPublishedGuidesMock,
}));

const guide: GuidePost = {
  contentBlocks: [
    {
      type: "image",
      props: {
        url: "https://assets.example.com/inline.jpg",
      },
    },
  ],
  coverImage: {
    alt: "Guide cover",
    path: "guide-cover.jpg",
    url: "https://assets.example.com/guide-cover.jpg",
  },
  createdAt: "2026-06-03T00:00:00.000Z",
  excerpt: "Guide excerpt",
  id: "guide-1",
  isPinned: false,
  publishedAt: "2026-06-03T00:00:00.000Z",
  recommendedHouseIds: [],
  slug: "guide-1",
  status: "published",
  tags: ["pattaya"],
  title: "Guide 1",
  updatedAt: "2026-06-03T00:00:00.000Z",
};

beforeEach(() => {
  vi.restoreAllMocks();
  getPublishedGuidesMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/guides/images/proxy", () => {
  it("returns 400 when the guide image URL is missing or unsafe", async () => {
    const { GET } = await import("../../../app/(public)/api/guides/images/proxy/route");

    const response = await GET(
      new Request("https://example.com/api/guides/images/proxy?url=http://x.test/a.jpg"),
    );

    await expect(response.json()).resolves.toEqual({ error: "Invalid image URL" });
    expect(response.status).toBe(400);
    expect(getPublishedGuidesMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the requested URL is not used by a published guide", async () => {
    getPublishedGuidesMock.mockResolvedValue([guide]);
    const { GET } = await import("../../../app/(public)/api/guides/images/proxy/route");

    const response = await GET(
      new Request(
        "https://example.com/api/guides/images/proxy?url=https%3A%2F%2Fassets.example.com%2Fother.jpg",
      ),
    );

    await expect(response.json()).resolves.toEqual({ error: "Image not found" });
    expect(response.status).toBe(404);
  });

  it("proxies a published guide cover with public display cache headers", async () => {
    getPublishedGuidesMock.mockResolvedValue([guide]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("guide bytes", {
          headers: { "Content-Type": "image/webp" },
        }),
      ),
    );
    const { GET } = await import("../../../app/(public)/api/guides/images/proxy/route");

    const response = await GET(
      new Request(
        "https://example.com/api/guides/images/proxy?url=https%3A%2F%2Fassets.example.com%2Fguide-cover.jpg",
      ),
    );

    await expect(response.text()).resolves.toBe("guide bytes");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=31536000",
    );
    expect(response.headers.get("Content-Type")).toBe("image/webp");
  });

  it("rejects unsupported guide image transform parameters", async () => {
    const { GET } = await import("../../../app/(public)/api/guides/images/proxy/route");

    const response = await GET(
      new Request(
        "https://example.com/api/guides/images/proxy?url=https%3A%2F%2Fassets.example.com%2Fguide-cover.jpg&w=999&q=50",
      ),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Invalid image transform",
    });
    expect(response.status).toBe(400);
    expect(getPublishedGuidesMock).not.toHaveBeenCalled();
  });

  it("uses Cloudflare image transforms for allowlisted guide image sizes", async () => {
    getPublishedGuidesMock.mockResolvedValue([guide]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("guide bytes", {
        headers: { "Content-Type": "image/avif" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("../../../app/(public)/api/guides/images/proxy/route");

    const response = await GET(
      new Request(
        "https://example.com/api/guides/images/proxy?url=https%3A%2F%2Fassets.example.com%2Fguide-cover.jpg&w=640&q=60",
        { headers: { Accept: "image/avif,image/webp,image/*,*/*" } },
      ),
    );

    await expect(response.text()).resolves.toBe("guide bytes");
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith("https://assets.example.com/guide-cover.jpg", {
      cache: "no-store",
      cf: {
        image: {
          fit: "scale-down",
          format: "avif",
          quality: 60,
          width: 640,
        },
      },
      redirect: "manual",
      signal: expect.any(AbortSignal),
    });
    expect(response.headers.get("Vary")).toBe("Accept");
  });

  it("normalizes guide image URLs before comparing them to the request URL", async () => {
    getPublishedGuidesMock.mockResolvedValue([
      {
        ...guide,
        coverImage: {
          alt: "Guide cover",
          path: "guide-cover.jpg",
          url: "https://ASSETS.example.com:443/guide-cover.jpg",
        },
      },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("guide bytes", {
          headers: { "Content-Type": "image/webp" },
        }),
      ),
    );
    const { GET } = await import("../../../app/(public)/api/guides/images/proxy/route");

    const response = await GET(
      new Request(
        "https://example.com/api/guides/images/proxy?url=https%3A%2F%2Fassets.example.com%2Fguide-cover.jpg",
      ),
    );

    await expect(response.text()).resolves.toBe("guide bytes");
    expect(response.status).toBe(200);
  });

  it("proxies a published guide inline image", async () => {
    getPublishedGuidesMock.mockResolvedValue([guide]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("inline bytes", {
          headers: { "Content-Type": "image/png" },
        }),
      ),
    );
    const { GET } = await import("../../../app/(public)/api/guides/images/proxy/route");

    const response = await GET(
      new Request(
        "https://example.com/api/guides/images/proxy?url=https%3A%2F%2Fassets.example.com%2Finline.jpg",
      ),
    );

    await expect(response.text()).resolves.toBe("inline bytes");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
  });
});
