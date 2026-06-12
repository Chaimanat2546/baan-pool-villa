import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VillaListing } from "@/lib/villas/types";

vi.mock("server-only", () => ({}));

const { fetchHouseListingsMock } = vi.hoisted(() => ({
  fetchHouseListingsMock: vi.fn(),
}));

vi.mock("@/lib/villas/server", () => ({
  fetchHouseListings: fetchHouseListingsMock,
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
      "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    );
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Last-Modified")).toBe(
      "Fri, 12 Jun 2026 00:00:00 GMT",
    );
  });
});
