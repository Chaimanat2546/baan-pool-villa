import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VillaListing } from "@/lib/villas/types";

vi.mock("server-only", () => ({}));

const { fetchHouseListingsMock, getListingByIdMock } = vi.hoisted(() => ({
  fetchHouseListingsMock: vi.fn(),
  getListingByIdMock: vi.fn(),
}));

vi.mock("@/lib/villas/server", () => ({
  fetchHouseListings: fetchHouseListingsMock,
  getListingById: getListingByIdMock,
}));

const listing: VillaListing = {
  amenities: [],
  bathrooms: 4,
  bedrooms: 5,
  coverImage: "https://devillegroups.com/imgs/profile_imgs_large/501.jpg",
  distanceToSea: "500m",
  id: "501",
  people: 12,
  poolType: "private",
  price: 12000,
  zone: "jomtien",
  zoneLabel: "Jomtien",
};

beforeEach(() => {
  vi.restoreAllMocks();
  fetchHouseListingsMock.mockReset();
  getListingByIdMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/houses/images/proxy", () => {
  it("returns 400 when the cover image URL is missing or unsafe", async () => {
    const { GET } = await import(
      "../../../app/(public)/api/houses/images/proxy/route"
    );

    const response = await GET(
      new Request("https://example.com/api/houses/images/proxy?url=http://x.test/a.jpg"),
    );

    await expect(response.json()).resolves.toEqual({ error: "Invalid image URL" });
    expect(response.status).toBe(400);
    expect(fetchHouseListingsMock).not.toHaveBeenCalled();
  });

  it("returns 400 when image transform params are unsupported", async () => {
    const { GET } = await import(
      "../../../app/(public)/api/houses/images/proxy/route"
    );

    const response = await GET(
      new Request(
        "https://example.com/api/houses/images/proxy?url=https%3A%2F%2Fdevillegroups.com%2Fimgs%2Fprofile_imgs_large%2F501.jpg&w=999",
      ),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Invalid image transform",
    });
    expect(response.status).toBe(400);
    expect(fetchHouseListingsMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the requested URL is not a public listing cover", async () => {
    fetchHouseListingsMock.mockResolvedValue([listing]);
    const { GET } = await import(
      "../../../app/(public)/api/houses/images/proxy/route"
    );

    const response = await GET(
      new Request(
        "https://example.com/api/houses/images/proxy?url=https%3A%2F%2Fimages.example.com%2Fother.jpg",
      ),
    );

    await expect(response.json()).resolves.toEqual({ error: "Image not found" });
    expect(response.status).toBe(404);
  });

  it("proxies an allowed listing cover with public display cache headers", async () => {
    fetchHouseListingsMock.mockResolvedValue([listing]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("cover bytes", {
        headers: {
          "Content-Type": "image/jpeg",
          "Last-Modified": "Fri, 12 Jun 2026 00:00:00 GMT",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import(
      "../../../app/(public)/api/houses/images/proxy/route"
    );

    const response = await GET(
      new Request(
        "https://example.com/api/houses/images/proxy?url=https%3A%2F%2Fdevillegroups.com%2Fimgs%2Fprofile_imgs_large%2F501.jpg",
      ),
    );

    await expect(response.text()).resolves.toBe("cover bytes");
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://devillegroups.com/imgs/profile_imgs_large/501.jpg",
      {
        cache: "no-store",
        redirect: "manual",
        signal: expect.any(AbortSignal),
      },
    );
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=31536000",
    );
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Last-Modified")).toBe(
      "Fri, 12 Jun 2026 00:00:00 GMT",
    );
  });

  it("uses Cloudflare image transformations for allowlisted display sizes", async () => {
    fetchHouseListingsMock.mockResolvedValue([listing]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("cover bytes", {
        headers: { "Content-Type": "image/avif" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import(
      "../../../app/(public)/api/houses/images/proxy/route"
    );

    const response = await GET(
      new Request(
        "https://example.com/api/houses/images/proxy?url=https%3A%2F%2Fdevillegroups.com%2Fimgs%2Fprofile_imgs_large%2F501.jpg&w=640&q=60",
        { headers: { Accept: "image/avif,image/webp,image/*,*/*" } },
      ),
    );

    await expect(response.text()).resolves.toBe("cover bytes");
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://devillegroups.com/imgs/profile_imgs_large/501.jpg",
      {
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
      },
    );
    expect(response.headers.get("Vary")).toBe("Accept");
  });

  it("normalizes listing cover URLs before comparing them to the request URL", async () => {
    fetchHouseListingsMock.mockResolvedValue([
      {
        ...listing,
        coverImage: "https://DEVILLEGROUPS.com:443/imgs/profile_imgs_large/501.jpg",
      },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("cover bytes", {
          headers: { "Content-Type": "image/jpeg" },
        }),
      ),
    );
    const { GET } = await import(
      "../../../app/(public)/api/houses/images/proxy/route"
    );

    const response = await GET(
      new Request(
        "https://example.com/api/houses/images/proxy?url=https%3A%2F%2Fdevillegroups.com%2Fimgs%2Fprofile_imgs_large%2F501.jpg",
      ),
    );

    await expect(response.text()).resolves.toBe("cover bytes");
    expect(response.status).toBe(200);
  });
});

describe("GET /api/houses/images/[id]", () => {
  it("proxies a listing cover by house id without requiring the source URL in the request", async () => {
    getListingByIdMock.mockResolvedValue(listing);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("cover bytes", {
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import(
      "../../../app/(public)/api/houses/images/[id]/route"
    );

    const response = await GET(
      new Request("https://example.com/api/houses/images/501?w=640&q=60"),
      { params: Promise.resolve({ id: "501" }) },
    );

    await expect(response.text()).resolves.toBe("cover bytes");
    expect(response.status).toBe(200);
    expect(getListingByIdMock).toHaveBeenCalledWith("501");
    expect(fetchHouseListingsMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://devillegroups.com/imgs/profile_imgs_large/501.jpg",
      expect.objectContaining({
        cache: "no-store",
        cf: {
          image: {
            fit: "scale-down",
            quality: 60,
            width: 640,
          },
        },
      }),
    );
  });

  it("returns 404 when the house id has no cover image", async () => {
    getListingByIdMock.mockResolvedValue({ ...listing, coverImage: null });
    const { GET } = await import(
      "../../../app/(public)/api/houses/images/[id]/route"
    );

    const response = await GET(
      new Request("https://example.com/api/houses/images/501"),
      { params: Promise.resolve({ id: "501" }) },
    );

    await expect(response.json()).resolves.toEqual({ error: "Image not found" });
    expect(response.status).toBe(404);
    expect(fetchHouseListingsMock).not.toHaveBeenCalled();
  });
});
