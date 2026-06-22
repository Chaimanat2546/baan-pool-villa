import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSearchPageData } from "@/components/villas/search/page-data";
import type { VillaListing } from "@/lib/villas/types";
import { fetchVillaSearchFacets, fetchVillaSearchPage } from "@/lib/villas/server";

vi.mock("@/lib/villas/server", () => ({
  fetchVillaSearchFacets: vi.fn(),
  fetchVillaSearchPage: vi.fn(),
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

const fetchVillaSearchFacetsMock = vi.mocked(fetchVillaSearchFacets);
const fetchVillaSearchPageMock = vi.mocked(fetchVillaSearchPage);

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
    fetchVillaSearchFacetsMock.mockResolvedValue({
      maxPrice: 18000,
      zones: [
        { value: "jomtien", label: "Jomtien" },
        { value: "pattaya", label: "Pattaya" },
      ],
    });
  });

  it("returns landing first-page metadata when listings load successfully", async () => {
    fetchVillaSearchPageMock.mockResolvedValue({
      facets: {
        maxPrice: 18000,
        zones: [
          { value: "jomtien", label: "Jomtien" },
          { value: "pattaya", label: "Pattaya" },
        ],
      },
      hasMore: false,
      items: villas,
      page: 1,
      pageSize: 12,
      total: 2,
    });

    const result = await getSearchPageData({});

    expect(result).toEqual({
      error: null,
      villas: [
        {
          ...villas[0],
          coverImage: "https://devillegroups.com/imgs/profile_imgs_large/901.jpg",
        },
        {
          ...villas[1],
          coverImage: "https://devillegroups.com/imgs/profile_imgs_large/902.jpg",
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

  it("server-loads the first page for query variations", async () => {
    fetchVillaSearchPageMock.mockResolvedValue({
      facets: {
        maxPrice: 18000,
        zones: [
          { value: "jomtien", label: "Jomtien" },
          { value: "pattaya", label: "Pattaya" },
        ],
      },
      hasMore: false,
      items: [villas[1]],
      page: 1,
      pageSize: 12,
      total: 1,
    });

    const result = await getSearchPageData({
      id: "902",
      sort: "price_desc",
      zone: "pattaya",
    });

    expect(JSON.stringify(result.villas)).toContain("devillegroups.com");
    expect(result.meta.resultCount).toBe(1);
    expect(fetchVillaSearchPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sortKey: "price_desc",
        villaIdQuery: "902",
      }),
    );
  });

  it("keeps the catalog marked incomplete when the initial server load fails", async () => {
    fetchVillaSearchFacetsMock.mockRejectedValue(new Error("catalog offline"));

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
    fetchVillaSearchFacetsMock.mockResolvedValue({
      maxPrice: 18000,
      zones: [
        { value: "jomtien", label: "Jomtien" },
        { value: "pattaya", label: "Pattaya" },
      ],
    });
    fetchVillaSearchPageMock.mockResolvedValue({
      facets: {
        maxPrice: 18000,
        zones: [
          { value: "jomtien", label: "Jomtien" },
          { value: "pattaya", label: "Pattaya" },
        ],
      },
      hasMore: false,
      items: villas,
      page: 1,
      pageSize: 12,
      total: 2,
    });
  });

  it("passes query params into server search data loading and initial render", async () => {
    const { default: SearchPageRoute } = await import("./page");
    const rendered = await SearchPageRoute({
      searchParams: Promise.resolve({ id: "902", sort: "price_desc" }),
    });

    const searchPageElement = rendered.props.children;

    expect(fetchVillaSearchPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sortKey: "price_desc",
        villaIdQuery: "902",
      }),
    );
    expect(searchPageElement.props.initialSearchParams).toBe("id=902&sort=price_desc");
  });
});
