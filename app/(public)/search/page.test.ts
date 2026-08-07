import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSearchPageData } from "@/components/villas/search/page-data";
import { SEARCH_FACETS } from "@/lib/villas/search-options";
import { DEFAULT_SITE_WEB_STYLES } from "@/lib/site-web-styles/defaults";
import { getSiteWebStyles } from "@/lib/site-web-styles/server";
import type { VillaListing } from "@/lib/villas/types";
import {
  fetchVillaSearchPage,
  withVillaCardGalleryPreviews,
} from "@/lib/villas/server";

vi.mock("@/lib/villas/server", () => ({
  fetchVillaSearchPage: vi.fn(),
  withVillaCardGalleryPreviews: vi.fn((villas) => Promise.resolve(villas)),
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

vi.mock("@/lib/site-web-styles/server", () => ({
  getSiteWebStyles: vi.fn(),
}));

const fetchVillaSearchPageMock = vi.mocked(fetchVillaSearchPage);
const withVillaCardGalleryPreviewsMock = vi.mocked(withVillaCardGalleryPreviews);
const getSiteWebStylesMock = vi.mocked(getSiteWebStyles);

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
    withVillaCardGalleryPreviewsMock.mockImplementation((villas) => Promise.resolve(villas));
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
          coverImage: "/api/houses/images/901",
        },
        {
          ...villas[1],
          coverImage: "/api/houses/images/902",
        },
      ],
      meta: {
        catalogComplete: false,
        maxPrice: SEARCH_FACETS.maxPrice,
        resultCount: 2,
        zones: SEARCH_FACETS.zones,
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

    expect(JSON.stringify(result.villas)).toContain("/api/houses/images/902");
    expect(JSON.stringify(result.villas)).not.toContain("devillegroups.com");
    expect(result.meta.resultCount).toBe(1);
    expect(fetchVillaSearchPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sortKey: "price_desc",
        villaIdQuery: "902",
      }),
    );
  });

  it("keeps the catalog marked incomplete when the initial server load fails", async () => {
    fetchVillaSearchPageMock.mockRejectedValue(new Error("catalog offline"));

    const result = await getSearchPageData({});

    expect(result.villas).toEqual([]);
    expect(result.meta).toEqual({
      catalogComplete: false,
      maxPrice: SEARCH_FACETS.maxPrice,
      resultCount: 0,
      zones: SEARCH_FACETS.zones,
    });
    expect(result.error).toBeTruthy();
  });
});

describe("SearchPage route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSiteWebStylesMock.mockResolvedValue({
      ...DEFAULT_SITE_WEB_STYLES,
      houseCard: { variant: "gallery" },
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
    expect(searchPageElement.props.villaCardStyle).toBe("gallery");
  });
});
