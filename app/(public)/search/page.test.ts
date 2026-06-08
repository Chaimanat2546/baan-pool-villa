import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSearchPageData } from "@/components/villas/search/page-data";
import type { VillaListing } from "@/lib/villas/types";
import { fetchHouseListings } from "@/lib/villas/server";

vi.mock("@/lib/villas/server", () => ({
  fetchHouseListings: vi.fn(),
}));

const fetchHouseListingsMock = vi.mocked(fetchHouseListings);

const villas: VillaListing[] = [
  {
    amenities: [],
    bathrooms: 4,
    bedrooms: 5,
    coverImage: "https://devillegroups.com/imgs/profile_imgs_large/901.jpg",
    distanceToSea: "500m",
    id: "901",
    people: 12,
    poolType: "private",
    price: 12000,
    zone: "jomtien",
    zoneLabel: "Jomtien",
  },
  {
    amenities: [],
    bathrooms: 3,
    bedrooms: 4,
    coverImage: "https://devillegroups.com/imgs/profile_imgs_large/902.jpg",
    distanceToSea: "900m",
    id: "902",
    people: 10,
    poolType: "private",
    price: 18000,
    zone: "pattaya",
    zoneLabel: "Pattaya",
  },
];

describe("getSearchPageData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns partial first-page metadata when listings load successfully", async () => {
    fetchHouseListingsMock.mockResolvedValue(villas);

    const result = await getSearchPageData({ sort: "price_desc" });

    expect(result).toEqual({
      error: null,
      villas: [villas[1], villas[0]],
      meta: {
        catalogComplete: false,
        maxPrice: 18000,
        resultCount: 2,
        zones: [
          { value: "jomtien", label: "Jomtien" },
          { value: "pattaya", label: "Pattaya" },
        ],
      },
    });
  });

  it("keeps the catalog marked incomplete when the initial server load fails", async () => {
    fetchHouseListingsMock.mockRejectedValue(new Error("catalog offline"));

    const result = await getSearchPageData({});

    expect(result.villas).toEqual([]);
    expect(result.meta).toEqual({
      catalogComplete: false,
      maxPrice: 1000,
      resultCount: 0,
      zones: [],
    });
    expect(result.error).toBeTruthy();
  });
});
