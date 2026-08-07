import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PUBLIC_RATE_LIMIT_POLICIES,
  resetPublicRateLimitForTests,
} from "@/lib/api/rate-limit";
import type { VillaImage } from "@/lib/villas/types";
import {
  buildImageDownloadFilename,
  createAttachmentDisposition,
  fetchAllowedVillaImageDownload,
  isAllowedVillaImageUrl,
  normalizeDownloadImageUrl,
} from "../image-download";

vi.mock("server-only", () => ({}));

const { fetchVillaDetailMock, fetchVillaImagesMock, getListingByIdMock } = vi.hoisted(() => ({
  fetchVillaDetailMock: vi.fn(),
  fetchVillaImagesMock: vi.fn(),
  getListingByIdMock: vi.fn(),
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
  getListingById: getListingByIdMock,
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
  resetPublicRateLimitForTests();
  fetchVillaImagesMock.mockReset();
  fetchVillaDetailMock.mockReset();
  getListingByIdMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
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

  it("allows exact villa image URLs without falling back to the listing cover", () => {
    expect(isAllowedVillaImageUrl("https://images.example.com/pool.jpg", imageRows)).toBe(
      true,
    );
    expect(
      isAllowedVillaImageUrl(
        "https://devillegroups.com/imgs/profile_imgs_large/cover.jpg",
        imageRows,
      ),
    ).toBe(false);
    expect(
      isAllowedVillaImageUrl("https://images.example.com/other-villa.jpg", imageRows),
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

  it("manually follows only allowed image redirects", async () => {
    const finalImage = {
      ...imageRows[0],
      imageUrl: "https://images.example.com/final.jpg",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          headers: { Location: finalImage.imageUrl },
          status: 302,
        }),
      )
      .mockResolvedValueOnce(
        new Response("photo bytes", {
          headers: { "Content-Type": "image/jpeg" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchAllowedVillaImageDownload(
      "https://images.example.com/pool.jpg",
      [...imageRows, finalImage],
      { cache: "no-store" },
    );

    expect(response?.status).toBe(200);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://images.example.com/pool.jpg",
      { cache: "no-store", redirect: "manual" },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://images.example.com/final.jpg",
      { cache: "no-store", redirect: "manual" },
    );
  });

  it("rejects redirects outside the villa image allowlist", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        headers: { Location: "https://evil.example.com/pool.jpg" },
        status: 302,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchAllowedVillaImageDownload("https://images.example.com/pool.jpg", imageRows),
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed redirect locations without throwing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        headers: { Location: "http://[::1" },
        status: 302,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchAllowedVillaImageDownload("https://images.example.com/pool.jpg", imageRows),
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
    expect(fetchVillaDetailMock).not.toHaveBeenCalled();
  });

  it("does not download the listing API cover as a villa gallery image", async () => {
    fetchVillaImagesMock.mockResolvedValue(imageRows);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/images/download/route"
    );

    const response = await GET(
      new Request(
        "https://example.com/api/villas/9/images/download?url=https%3A%2F%2Fdevillegroups.com%2Fimgs%2Fprofile_imgs_large%2Fcover.jpg",
      ),
      { params: Promise.resolve({ id: "9" }) },
    );

    await expect(response.json()).resolves.toEqual({ error: "Image not found" });
    expect(response.status).toBe(404);
    expect(fetchVillaDetailMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("downloads the current listing cover through the dedicated cover endpoint", async () => {
    getListingByIdMock.mockResolvedValue({
      coverImage: "https://devillegroups.com/imgs/profile_imgs_large/cover.jpg",
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("cover bytes", { headers: { "Content-Type": "image/webp" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/images/download/route"
    );

    const response = await GET(
      new Request("https://example.com/api/villas/9/images/download?cover=1"),
      { params: Promise.resolve({ id: "9" }) },
    );

    expect(response.status).toBe(200);
    expect(getListingByIdMock).toHaveBeenCalledWith("9");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="villa-9-cover-cover.webp"',
    );
  });

  it("downloads a non-S3 gallery image through the validated public proxy", async () => {
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
    expect(fetchMock).toHaveBeenCalledWith(
      "https://images.example.com/pool.jpg",
      expect.objectContaining({
        cache: "no-store",
        cf: {
          image: {
            fit: "scale-down",
            quality: 90,
            width: 1920,
          },
        },
        redirect: "manual",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="villa-9-pool-pool.jpg"',
    );
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it("downloads an authorized private S3 gallery image through the WebP loader", async () => {
    const privateS3Url =
      "https://s3.ap-southeast-1.amazonaws.com/poolvillas.co.ltd/pool.jpg";
    fetchVillaImagesMock.mockResolvedValue([
      {
        ...imageRows[0],
        imageUrl: privateS3Url,
      },
    ]);
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const fetchUrl =
        input instanceof Request ? input.url : input.toString();

      if (fetchUrl === privateS3Url) {
        return Promise.resolve(new Response("forbidden", { status: 403 }));
      }

      return Promise.resolve(
        new Response("webp bytes", {
          headers: { "Content-Type": "image/webp" },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/images/download/route"
    );

    const response = await GET(
      new Request(
        "https://example.com/api/villas/9/images/download?url=https%3A%2F%2Fs3.ap-southeast-1.amazonaws.com%2Fpoolvillas.co.ltd%2Fpool.jpg&zone=pool&name=pool.jpg",
      ),
      { params: Promise.resolve({ id: "9" }) },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        "d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/pool.jpg?w=1920&q=90",
      ),
      expect.objectContaining({
        cache: "no-store",
        redirect: "manual",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(
      fetchMock.mock.calls.some(([input]) => {
        const fetchUrl =
          input instanceof Request ? input.url : input.toString();

        return fetchUrl === privateS3Url;
      }),
    ).toBe(false);
    await expect(response.text()).resolves.toBe("webp bytes");
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="villa-9-pool-pool.webp"',
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
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
