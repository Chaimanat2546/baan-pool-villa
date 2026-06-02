import { afterEach, describe, expect, it, vi } from "vitest";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import type { RawHouse } from "../types";
import { fetchHouseListings, fetchVillaDetail, fetchVillaPageData } from "../server";

vi.mock("server-only", () => ({}));

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
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("fetchHouseListings", () => {
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
  it("returns server-fetched detail payload with an empty image fallback when gallery loading fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([rawHouse]));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("DEVILLE_BEARER_TOKEN", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");

    await expect(fetchVillaPageData("9")).resolves.toMatchObject({
      payload: {
        listing: { id: "9" },
        detail: null,
        detailStatus: "missing_token",
      },
      images: [],
      recommendedVillas: [],
    });
  });
});
