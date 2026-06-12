import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PUBLIC_RATE_LIMIT_POLICIES,
  resetPublicRateLimitForTests,
} from "@/lib/api/rate-limit";
import type { VillaDetailPayload, VillaImage } from "@/lib/villas/types";
import {
  buildImageDownloadFilename,
  createAttachmentDisposition,
  isAllowedVillaImageUrl,
  normalizeDownloadImageUrl,
} from "../image-download";

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

const detailPayload = {
  listing: {
    coverImage: "https://devillegroups.com/imgs/profile_imgs_large/cover.jpg",
  },
} as VillaDetailPayload;

beforeEach(() => {
  vi.restoreAllMocks();
  resetPublicRateLimitForTests();
  fetchVillaImagesMock.mockReset();
  fetchVillaDetailMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("download image validation helpers", () => {
  it("accepts only normalized https image URLs", () => {
    expect(normalizeDownloadImageUrl("https://images.example.com/pool.jpg")).toBe(
      "https://images.example.com/pool.jpg",
    );
    expect(normalizeDownloadImageUrl("http://images.example.com/pool.jpg")).toBeNull();
    expect(normalizeDownloadImageUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeDownloadImageUrl("not a url")).toBeNull();
  });

  it("rejects private network image URLs", () => {
    expect(normalizeDownloadImageUrl("https://localhost/pool.jpg")).toBeNull();
    expect(normalizeDownloadImageUrl("https://127.0.0.1/pool.jpg")).toBeNull();
    expect(normalizeDownloadImageUrl("https://10.0.0.1/pool.jpg")).toBeNull();
    expect(normalizeDownloadImageUrl("https://172.16.0.1/pool.jpg")).toBeNull();
    expect(normalizeDownloadImageUrl("https://192.168.1.1/pool.jpg")).toBeNull();
    expect(normalizeDownloadImageUrl("https://169.254.169.254/pool.jpg")).toBeNull();
    expect(normalizeDownloadImageUrl("https://[::1]/pool.jpg")).toBeNull();
    expect(normalizeDownloadImageUrl("https://[fc00::1]/pool.jpg")).toBeNull();
    expect(normalizeDownloadImageUrl("https://[fe80::1]/pool.jpg")).toBeNull();
  });

  it("allows exact villa image URLs and the listing cover only", () => {
    expect(
      isAllowedVillaImageUrl("https://images.example.com/pool.jpg", imageRows, detailPayload),
    ).toBe(true);
    expect(
      isAllowedVillaImageUrl(
        "https://devillegroups.com/imgs/profile_imgs_large/cover.jpg",
        imageRows,
        detailPayload,
      ),
    ).toBe(true);
    expect(
      isAllowedVillaImageUrl("https://images.example.com/other-villa.jpg", imageRows, detailPayload),
    ).toBe(false);
  });

  it("normalizes stored villa image URLs before allowlist comparison", () => {
    expect(
      isAllowedVillaImageUrl(
        "https://images.example.com/pool.jpg",
        [
          {
            ...imageRows[0],
            imageUrl: "https://IMAGES.example.com:443/pool.jpg",
          },
        ],
        null,
      ),
    ).toBe(true);
  });

  it("builds safe attachment filenames from villa and image metadata", () => {
    expect(
      buildImageDownloadFilename({
        contentType: "image/jpeg",
        imageName: "Pool View.JPG",
        villaId: "12",
        zoneKey: "pool deck",
      }),
    ).toBe("villa-12-pool-deck-pool-view.jpg");

    expect(createAttachmentDisposition("villa 12 pool.jpg")).toBe(
      'attachment; filename="villa-12-pool.jpg"',
    );
  });
});

describe("GET /api/villas/[id]/images/download", () => {
  it("rate limits repeated downloads before loading image data or fetching upstream", async () => {
    fetchVillaImagesMock.mockResolvedValue(imageRows);
    fetchVillaDetailMock.mockResolvedValue(null);
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response("photo bytes", {
          headers: { "Content-Type": "image/jpeg" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/images/download/route"
    );
    const request = new Request(
      "https://example.com/api/villas/9/images/download?url=https%3A%2F%2Fimages.example.com%2Fpool.jpg",
      { headers: { "CF-Connecting-IP": "203.0.113.90" } },
    );
    const context = { params: Promise.resolve({ id: "9" }) };

    for (
      let index = 0;
      index < PUBLIC_RATE_LIMIT_POLICIES.publicDownload.limit;
      index += 1
    ) {
      const response = await GET(request, context);
      expect(response.status).not.toBe(429);
    }

    fetchVillaImagesMock.mockClear();
    fetchVillaDetailMock.mockClear();
    fetchMock.mockClear();
    const blocked = await GET(request, context);

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("60");
    expect(blocked.headers.get("Cache-Control")).toBe("no-store");
    await expect(blocked.json()).resolves.toEqual({
      error: "Too many requests.",
      retryAfterSeconds: 60,
    });
    expect(fetchVillaImagesMock).not.toHaveBeenCalled();
    expect(fetchVillaDetailMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid villa ids before loading image data", async () => {
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/images/download/route"
    );

    const response = await GET(
      new Request("https://example.com/api/villas/abc/images/download?url=https://x.test/a.jpg"),
      { params: Promise.resolve({ id: "abc" }) },
    );

    await expect(response.json()).resolves.toEqual({ error: "Invalid villa id" });
    expect(response.status).toBe(400);
    expect(fetchVillaImagesMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the requested download URL is missing or unsafe", async () => {
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/images/download/route"
    );

    const response = await GET(
      new Request("https://example.com/api/villas/9/images/download?url=http://x.test/a.jpg"),
      { params: Promise.resolve({ id: "9" }) },
    );

    await expect(response.json()).resolves.toEqual({ error: "Invalid image URL" });
    expect(response.status).toBe(400);
    expect(fetchVillaImagesMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the requested URL is not part of the villa gallery", async () => {
    fetchVillaImagesMock.mockResolvedValue(imageRows);
    fetchVillaDetailMock.mockResolvedValue(detailPayload);
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/images/download/route"
    );

    const response = await GET(
      new Request(
        "https://example.com/api/villas/9/images/download?url=https%3A%2F%2Fimages.example.com%2Fother.jpg",
      ),
      { params: Promise.resolve({ id: "9" }) },
    );

    await expect(response.json()).resolves.toEqual({ error: "Image not found" });
    expect(response.status).toBe(404);
  });

  it("proxies an allowed gallery image as an attachment", async () => {
    fetchVillaImagesMock.mockResolvedValue(imageRows);
    fetchVillaDetailMock.mockResolvedValue(null);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response("photo bytes", { headers: { "Content-Type": "image/jpeg" } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/images/download/route"
    );

    const response = await GET(
      new Request(
        "https://example.com/api/villas/9/images/download?url=https%3A%2F%2Fimages.example.com%2Fpool.jpg&zone=pool&name=pool.jpg",
      ),
      { params: Promise.resolve({ id: "9" }) },
    );

    await expect(response.text()).resolves.toBe("photo bytes");
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith("https://images.example.com/pool.jpg", {
      cache: "no-store",
      signal: expect.any(AbortSignal),
    });
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="villa-9-pool-pool.jpg"',
    );
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it("rejects upstream responses that are not images", async () => {
    fetchVillaImagesMock.mockResolvedValue(imageRows);
    fetchVillaDetailMock.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("html", { headers: { "Content-Type": "text/html" } })),
    );
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/images/download/route"
    );

    const response = await GET(
      new Request(
        "https://example.com/api/villas/9/images/download?url=https%3A%2F%2Fimages.example.com%2Fpool.jpg",
      ),
      { params: Promise.resolve({ id: "9" }) },
    );

    await expect(response.json()).resolves.toEqual({ error: "Unable to download image" });
    expect(response.status).toBe(502);
  });

  it("times out slow upstream image downloads", async () => {
    vi.useFakeTimers();
    fetchVillaImagesMock.mockResolvedValue(imageRows);
    fetchVillaDetailMock.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }),
      ),
    );
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/images/download/route"
    );

    const responsePromise = GET(
      new Request(
        "https://example.com/api/villas/9/images/download?url=https%3A%2F%2Fimages.example.com%2Fpool.jpg",
      ),
      { params: Promise.resolve({ id: "9" }) },
    );

    await vi.advanceTimersByTimeAsync(10_000);
    const response = await responsePromise;

    await expect(response.json()).resolves.toEqual({ error: "Unable to download image" });
    expect(response.status).toBe(502);
  });
});
