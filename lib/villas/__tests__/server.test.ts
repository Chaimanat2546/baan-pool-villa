import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { unstable_cache } from "next/cache";
import type { RawHouse } from "../types";
import {
  fetchHouseListings,
  fetchHouseListingsForSitemap,
  fetchVillaDetail,
  fetchVillaPageData,
} from "../server";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn: unknown) => fn),
}));

const { fetchVillaPreviewImagesMock } = vi.hoisted(() => ({
  fetchVillaPreviewImagesMock: vi.fn(),
}));

const { getResolvedHomeSectionsMock } = vi.hoisted(() => ({
  getResolvedHomeSectionsMock: vi.fn(),
}));

vi.mock("@/lib/home-sections/server", () => ({
  getResolvedHomeSections: getResolvedHomeSectionsMock,
}));

vi.mock("../images", () => ({
  fetchVillaPreviewImages: fetchVillaPreviewImagesMock,
}));

const unstableCacheMock = vi.mocked(unstable_cache);

const rawHouse: RawHouse = {
  h_id: "9",
  h_zone: "pattaya",
  h_bedroom: "6",
  h_toilet: "5",
  h_farsea: "5.6 km",
  wifi: "y",
  grill: "n",
  pet: "n",
  snooker: "n",
  discotech: "n",
  fancyring: "n",
  tabletennis: "n",
  slider: "n",
  billard: "n",
  swimming_kid: "n",
  swim: "salt",
  karaoke: "y",
  airhockey: "n",
  jacuzzi: "n",
  bath: "n",
  img_name: "villa-9.jpg",
  price: "8000",
  people: "12",
};

function jsonResponse(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), init);
}

afterEach(() => {
  fetchVillaPreviewImagesMock.mockReset();
  getResolvedHomeSectionsMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

beforeEach(() => {
  fetchVillaPreviewImagesMock.mockResolvedValue([]);
});

describe("fetchHouseListings", () => {
  it("wraps the normalized villa catalog in a tagged Next cache", () => {
    expect(unstableCacheMock).toHaveBeenCalledWith(
      expect.any(Function),
      [CACHE_TAGS.villaListings],
      {
        revalidate: CACHE_REVALIDATE_SECONDS.villaListings,
        tags: [CACHE_TAGS.villaListings],
      },
    );
  });

  it("normalizes raw list API rows from the external API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([rawHouse]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchHouseListings()).resolves.toEqual([
      {
        id: "9",
        zone: "pattaya",
        zoneLabel: "\u0e1e\u0e31\u0e17\u0e22\u0e32",
        bedrooms: 6,
        bathrooms: 5,
        distanceToSea: "5.6 km",
        price: 9900,
        people: 12,
        coverImage: "https://devillegroups.com/imgs/profile_imgs_large/villa-9.jpg",
        amenities: [
          { key: "wifi", label: "Wi-Fi" },
          { key: "karaoke", label: "\u0e04\u0e32\u0e23\u0e32\u0e42\u0e2d\u0e40\u0e01\u0e30" },
        ],
        poolType: "salt",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.devillegroups.com/api/json/getHouse_deville.json",
      {
        next: {
          revalidate: CACHE_REVALIDATE_SECONDS.villaListings,
          tags: [CACHE_TAGS.villaListings],
        },
      },
    );
  });

  it("loads sitemap villa routes with a twenty-four-hour fetch cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([rawHouse]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchHouseListingsForSitemap()).resolves.toEqual([
      expect.objectContaining({ id: "9" }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.devillegroups.com/api/json/getHouse_deville.json",
      {
        next: {
          revalidate: CACHE_REVALIDATE_SECONDS.sitemap,
          tags: [CACHE_TAGS.villaListings],
        },
      },
    );
  });
});

describe("fetchVillaDetail", () => {
  it("returns listing with missing token status and does not fetch detail when token is not set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([rawHouse]));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("DEVILLE_BEARER_TOKEN", "");

    await expect(fetchVillaDetail("9")).resolves.toMatchObject({
      listing: { id: "9" },
      detail: null,
      detailStatus: "missing_token",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when no listing exists for the requested id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([rawHouse]));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("DEVILLE_BEARER_TOKEN", "token");

    await expect(fetchVillaDetail("999")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches successful detail API requests by villa id", async () => {
    const listing = (await import("../normalize")).normalizeHouses([rawHouse])[0];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ house_id: "9" }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("DEVILLE_BEARER_TOKEN", "token");

    await expect(fetchVillaDetail("9", [listing])).resolves.toMatchObject({
      listing: { id: "9" },
      detail: { house_id: "9" },
      detailStatus: "available",
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBeInstanceOf(URL);
    expect((url as URL).searchParams.get("hid")).toBe("9");
    expect(init).toEqual({
      headers: {
        Authorization: "Bearer token",
      },
      next: {
        revalidate: CACHE_REVALIDATE_SECONDS.villaDetail,
        tags: [CACHE_TAGS.villaDetails, CACHE_TAGS.villaDetail("9")],
      },
    });
  });
});

describe("fetchVillaPageData", () => {
  it("returns server-fetched detail payload with up to four initial gallery images", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([rawHouse]));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("DEVILLE_BEARER_TOKEN", "");
    getResolvedHomeSectionsMock.mockResolvedValue({
      degraded: false,
      sections: [],
      source: "config",
    });
    fetchVillaPreviewImagesMock.mockResolvedValue([
      {
        caption: null,
        id: 1,
        imageName: "pool.jpg",
        imageUrl: "https://images.example.com/pool.jpg",
        isCover: false,
        zone: "outside",
      },
      {
        caption: null,
        id: 2,
        imageName: "bedroom.jpg",
        imageUrl: "https://images.example.com/bedroom.jpg",
        isCover: false,
        zone: "inside",
      },
      {
        caption: null,
        id: 3,
        imageName: "living.jpg",
        imageUrl: "https://images.example.com/living.jpg",
        isCover: false,
        zone: "inside",
      },
      {
        caption: null,
        id: 4,
        imageName: "cover.jpg",
        imageUrl: "https://images.example.com/cover.jpg",
        isCover: true,
        zone: "cover",
      },
      {
        caption: null,
        id: 5,
        imageName: "extra.jpg",
        imageUrl: "https://images.example.com/extra.jpg",
        isCover: false,
        zone: "outside",
      },
    ]);

    const data = await fetchVillaPageData("9");

    expect(data).toMatchObject({
      payload: {
        listing: { id: "9" },
        detail: null,
        detailStatus: "missing_token",
      },
      recommendedSection: null,
    });
    expect(data?.initialGalleryImages).toEqual([
      expect.objectContaining({
        id: 1,
        imageUrl: "/api/villas/9/images?imageId=1",
      }),
      expect.objectContaining({
        id: 2,
        imageUrl: "/api/villas/9/images?imageId=2",
      }),
      expect.objectContaining({
        id: 3,
        imageUrl: "/api/villas/9/images?imageId=3",
      }),
      expect.objectContaining({
        id: 4,
        imageUrl: "/api/villas/9/images?imageId=4",
      }),
    ]);
    expect(data?.payload.listing.coverImage).toBe("/api/houses/images/9");
    expect(JSON.stringify(data)).not.toContain("images.example.com");
    expect(JSON.stringify(data)).not.toContain("devillegroups.com");
    expect(fetchVillaPreviewImagesMock).toHaveBeenCalledWith("9");
  });

  it("leaves villa recommendations out of the initial page payload", async () => {
    const secondRawHouse = {
      ...rawHouse,
      h_id: "10",
      img_name: "villa-10.jpg",
    };
    const thirdRawHouse = {
      ...rawHouse,
      h_id: "11",
      img_name: "villa-11.jpg",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse([rawHouse, secondRawHouse, thirdRawHouse]));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("DEVILLE_BEARER_TOKEN", "");

    const data = await fetchVillaPageData("9");

    expect(getResolvedHomeSectionsMock).not.toHaveBeenCalled();
    expect(data?.recommendedSection).toBeNull();
  });
});
