import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VillaImage } from "@/lib/villas/types";

vi.mock("server-only", () => ({}));

const { fetchVillaDetailMock, fetchVillaImagesMock } = vi.hoisted(() => ({
  fetchVillaDetailMock: vi.fn(),
  fetchVillaImagesMock: vi.fn(),
}));

vi.mock("@/lib/villas/images", () => ({
  fetchVillaImages: fetchVillaImagesMock,
  parseVillaId: (id: string) => {
    if (!/^[1-9]\d*$/.test(id)) {
      throw new Error("Invalid villa id");
    }
    return Number(id);
  },
}));

vi.mock("@/lib/villas/server", () => ({
  fetchVillaDetail: fetchVillaDetailMock,
}));

const imageRows: VillaImage[] = [
  {
    id: 1,
    imageUrl: "https://images.example.com/pool.jpg",
    imageName: "pool.jpg",
    caption: "Pool",
    isCover: false,
    zone: "pool",
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
  fetchVillaImagesMock.mockReset();
  fetchVillaDetailMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("GET /api/villas/[id]/images/proxy", () => {
  it("returns 400 for invalid villa ids before loading image data", async () => {
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/images/proxy/route"
    );

    const response = await GET(
      new Request("https://example.com/api/villas/abc/images/proxy?url=https://x.test/a.jpg"),
      { params: Promise.resolve({ id: "abc" }) },
    );

    await expect(response.json()).resolves.toEqual({ error: "Invalid villa id" });
    expect(response.status).toBe(400);
    expect(fetchVillaImagesMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the display image URL is missing or unsafe", async () => {
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/images/proxy/route"
    );

    const response = await GET(
      new Request("https://example.com/api/villas/9/images/proxy?url=http://x.test/a.jpg"),
      { params: Promise.resolve({ id: "9" }) },
    );

    await expect(response.json()).resolves.toEqual({ error: "Invalid image URL" });
    expect(response.status).toBe(400);
    expect(fetchVillaImagesMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the requested URL is not part of the villa gallery", async () => {
    fetchVillaImagesMock.mockResolvedValue(imageRows);
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/images/proxy/route"
    );

    const response = await GET(
      new Request(
        "https://example.com/api/villas/9/images/proxy?url=https%3A%2F%2Fimages.example.com%2Fother.jpg",
      ),
      { params: Promise.resolve({ id: "9" }) },
    );

    await expect(response.json()).resolves.toEqual({ error: "Image not found" });
    expect(response.status).toBe(404);
    expect(fetchVillaDetailMock).not.toHaveBeenCalled();
  });

  it("does not proxy the listing API cover as a villa gallery image", async () => {
    fetchVillaImagesMock.mockResolvedValue(imageRows);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/images/proxy/route"
    );

    const response = await GET(
      new Request(
        "https://example.com/api/villas/9/images/proxy?url=https%3A%2F%2Fdevillegroups.com%2Fimgs%2Fprofile_imgs_large%2Fcover.jpg",
      ),
      { params: Promise.resolve({ id: "9" }) },
    );

    await expect(response.json()).resolves.toEqual({ error: "Image not found" });
    expect(response.status).toBe(404);
    expect(fetchVillaDetailMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies an allowed gallery image with public display cache headers", async () => {
    fetchVillaImagesMock.mockResolvedValue(imageRows);
    fetchVillaDetailMock.mockResolvedValue(null);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("photo bytes", {
        headers: {
          "Content-Type": "image/jpeg",
          ETag: '"upstream-etag"',
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/images/proxy/route"
    );

    const response = await GET(
      new Request(
        "https://example.com/api/villas/9/images/proxy?url=https%3A%2F%2Fimages.example.com%2Fpool.jpg",
      ),
      { params: Promise.resolve({ id: "9" }) },
    );

    await expect(response.text()).resolves.toBe("photo bytes");
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith("https://images.example.com/pool.jpg", {
      cache: "no-store",
      redirect: "manual",
      signal: expect.any(AbortSignal),
    });
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=31536000",
    );
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("ETag")).toBe('"upstream-etag"');
  });

  it("rejects upstream responses that are not images", async () => {
    fetchVillaImagesMock.mockResolvedValue(imageRows);
    fetchVillaDetailMock.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("html", { headers: { "Content-Type": "text/html" } })),
    );
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/images/proxy/route"
    );

    const response = await GET(
      new Request(
        "https://example.com/api/villas/9/images/proxy?url=https%3A%2F%2Fimages.example.com%2Fpool.jpg",
      ),
      { params: Promise.resolve({ id: "9" }) },
    );

    await expect(response.json()).resolves.toEqual({ error: "Unable to load image" });
    expect(response.status).toBe(502);
  });
});
