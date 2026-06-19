import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSearchPageData } from "@/components/villas/search/page-data";
import type { VillaListing } from "@/lib/villas/types";
import { fetchHouseListings } from "@/lib/villas/server";

vi.mock("@/lib/villas/server", () => ({
  fetchHouseListings: vi.fn(),
}));

vi.mock("@/components/villas/search/page", () => ({
  SearchPage: (props: unknown) => ({
    props,
    type: "SearchPage",
  }),
}));

vi.mock("@/lib/site-settings/server", () => ({
  getSiteSettings: vi.fn(),
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

  it("returns landing first-page metadata when listings load successfully", async () => {
    fetchHouseListingsMock.mockResolvedValue(villas);

    const result = await getSearchPageData({});

    expect(result).toEqual({
      error: null,
      villas: [
        {
          ...villas[0],
          coverImage: "/api/houses/images/901",
        },
        {
          ...villas[1],
          coverImage: "/api/houses/images/902",
        },
      ],
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

  it("does not server-filter or server-sort query variations", async () => {
    fetchHouseListingsMock.mockResolvedValue(villas);

    const result = await getSearchPageData({
      id: "902",
      sort: "price_desc",
      zone: "pattaya",
    });

    expect(JSON.stringify(result.villas)).not.toContain("devillegroups.com");
    expect(result.meta.resultCount).toBe(2);
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

describe("SearchPage route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not pass query params into server search data loading", async () => {
    fetchHouseListingsMock.mockResolvedValue(villas);

    const { default: SearchPageRoute } = await import("./page");
    const rendered = await SearchPageRoute({
      searchParams: Promise.resolve({ id: "902", sort: "price_desc" }),
    });

    const searchPageElement = rendered.props.children;

    expect(searchPageElement.props.initialSearchParams).toBeUndefined();
  });
});
