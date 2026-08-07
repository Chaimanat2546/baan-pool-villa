import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { unstable_cache } from "next/cache";
import {
  fetchVillaCardHouseOptionPage,
  fetchActiveVillaZones,
  fetchHouseListings,
  fetchHouseListingsForSitemap,
  fetchHomeListings,
  fetchVillaSearchFacets,
  fetchVillaSearchPage,
  fetchVillaDetail,
  fetchVillaPageData,
} from "../server";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn: unknown) => fn),
}));

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

const { createHomeConfigClientMock } = vi.hoisted(() => ({
  createHomeConfigClientMock: vi.fn(),
}));

const { fetchVillaImagesMock } = vi.hoisted(() => ({
  fetchVillaImagesMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/home-sections/supabase", () => ({
  createHomeConfigClient: createHomeConfigClientMock,
}));

vi.mock("../images", async () => {
  const actual = await vi.importActual<typeof import("../images")>("../images");

  return {
    ...actual,
    fetchVillaImages: fetchVillaImagesMock,
  };
});

const unstableCacheMock = vi.mocked(unstable_cache);
const fetchMock = vi.fn();

const listingRows = [
  {
    bathrooms: 5,
    bedrooms: 6,
    checkin_time: "14:00:00",
    checkout_time: "11:00:00",
    description: "Large family villa",
    extra_beds: 500,
    id: "listing-9",
    insurance_fee: 3000,
    listing_facilities: [
      {
        facilities: { name: "wifi", title: "Wi-Fi" },
        value_boolean: true,
      },
      {
        facilities: { name: "karaoke", title: "Karaoke" },
        value_boolean: true,
      },
      {
        facilities: { name: "billiard", title: "โต๊ะพูล" },
        value_boolean: true,
      },
      {
        facilities: { name: "private_pool", title: "สระว่ายน้ำส่วนตัว" },
        value_boolean: true,
      },
      {
        facilities: { name: "extra_bed", title: "เตียงเสริม" },
        value_boolean: true,
      },
      {
        facilities: { name: "unknown_new_facility", title: "Later" },
        value_boolean: true,
      },
      {
        facilities: { name: "jacuzzi", title: "Jacuzzi" },
        value_boolean: false,
      },
    ],
    location_zone: "pattaya",
    max_guests: 12,
    notes: "No smoking",
    property_id: 9,
    property_tags: null,
    property_type: "salt",
    rating: 5,
    title: "บ้านพักสายลม 9",
  },
];

const imageRows = [
  {
    caption: null,
    cover_select: 1,
    id: 4,
    image_name: null,
    image_url: "https://example.supabase.co/storage/v1/object/public/villas/cover.jpg",
    image_zone: "cover",
    property_id: 9,
  },
];

const listingPriceRows = [
  {
    deville_price: 8500,
    listing_id: "listing-9",
  },
  {
    deville_price: 8000,
    listing_id: "listing-9",
  },
];

const listingFacilityRows = listingRows[0].listing_facilities.map((facility) => ({
  ...facility,
  listing_id: "listing-9",
}));

const devilleDetail = {
  h_bedroom_detail: "Bedroom 1: king bed",
  h_kitchen_ware: "Microwave\nThai kitchen equipment",
  h_swimmingpool: "3.5 x 8 m salt pool",
  location: "Jomtien, Pattaya",
  sea: "900 m",
};

type ImageRow = {
  caption: string | null;
  cover_select: number;
  id: number;
  image_name: string | null;
  image_url: string | null;
  image_zone: string | null;
  property_id: number | null;
};

function listingQuery(
  data: typeof listingRows | Array<typeof listingRows> = listingRows,
  error: unknown = null,
) {
  const pages = (Array.isArray(data[0]) ? data : [data]) as Array<
    typeof listingRows
  >;
  const query = {
    eq: vi.fn(() => query),
    gte: vi.fn(() => query),
    ilike: vi.fn(() => query),
    in: vi.fn(() => Promise.resolve({ data: pages[0] ?? [], error })),
    maybeSingle: vi.fn(() =>
      Promise.resolve({ data: pages[0]?.[0] ?? null, error }),
    ),
    order: vi.fn(() => query),
    range: vi.fn((from: number) =>
      Promise.resolve({
        count: pages[Math.floor(from / 1000)]?.length ?? 0,
        data: pages[Math.floor(from / 1000)] ?? [],
        error,
      }),
    ),
    select: vi.fn((...args: unknown[]) => {
      void args;
      return query;
    }),
  };

  return query;
}

function imagesQuery(data: ImageRow[] = imageRows, error: unknown = null) {
  const query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(),
    select: vi.fn(() => query),
  };
  query.order.mockReturnValueOnce(query).mockImplementation(() =>
    Promise.resolve({ data, error }),
  );

  return query;
}

function listingPricesQuery(data = listingPriceRows, error: unknown = null) {
  const query = {
    in: vi.fn(() => Promise.resolve({ data, error })),
    select: vi.fn(() => query),
  };

  return query;
}

function listingFacilitiesQuery(
  data = listingFacilityRows,
  error: unknown = null,
) {
  const query = {
    in: vi.fn(() => Promise.resolve({ data, error })),
    select: vi.fn(() => query),
  };

  return query;
}

type CoverOverrideRow = {
  cover_image_url: string | null;
  house_id: string | null;
};

function coverOverrideQuery(
  data: CoverOverrideRow[] = [],
  error: unknown = null,
) {
  const query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => Promise.resolve({ data, error })),
    select: vi.fn(() => query),
  };

  return query;
}

function mockCoverOverrides(
  data: CoverOverrideRow[] = [],
  error: unknown = null,
) {
  const query = coverOverrideQuery(data, error);
  const client = {
    from: vi.fn((table: string) => {
      if (table === "villa_card_image_configs") {
        return query;
      }

      throw new Error(`Unexpected home config table ${table}`);
    }),
  };

  createHomeConfigClientMock.mockReturnValue(client);

  return { client, query };
}

function mockSupabase(options?: {
  imageRows?: ImageRow[];
  listingFacilityRows?: typeof listingFacilityRows;
  listingPriceRows?: typeof listingPriceRows;
  listingError?: unknown;
  listingRows?: typeof listingRows;
  listingRowPages?: Array<typeof listingRows>;
  rpcRows?: Array<{ property_id: number; total_count: number }>;
  villaZoneRows?: Array<{ location_zone: string | null }>;
}) {
  const listings = listingQuery(
    options?.listingRowPages ?? options?.listingRows ?? listingRows,
    options?.listingError,
  );
  const images = imagesQuery(options?.imageRows ?? imageRows);
  const listingPrices = listingPricesQuery(
    options?.listingPriceRows ?? listingPriceRows,
  );
  const listingFacilities = listingFacilitiesQuery(
    options?.listingFacilityRows ?? listingFacilityRows,
  );
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "listings") {
        return listings;
      }

      if (table === "images") {
        return images;
      }

      if (table === "listing_prices") {
        return listingPrices;
      }

      if (table === "listing_facilities") {
        return listingFacilities;
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: vi.fn((functionName: string) =>
      Promise.resolve({
        data:
          functionName === "get_public_villa_zones"
            ? (options?.villaZoneRows ?? [])
            : (options?.rpcRows ?? []),
        error: null,
      }),
    ),
  };

  createClientMock.mockReturnValue(supabase);

  return { images, listingFacilities, listingPrices, listings, supabase };
}

afterEach(() => {
  createClientMock.mockReset();
  createHomeConfigClientMock.mockReset();
  fetchMock.mockReset();
  fetchVillaImagesMock.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable");
  vi.stubGlobal("fetch", fetchMock);
  mockCoverOverrides();
  fetchVillaImagesMock.mockResolvedValue([]);
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

  it("loads active Supabase listings with facilities and cover images", async () => {
    const { images, listingFacilities, listingPrices, listings } = mockSupabase();

    await expect(fetchHouseListings()).resolves.toEqual([
      {
        amenities: [
          { key: "wifi", label: "Wi-Fi" },
          { key: "karaoke", label: "Karaoke" },
          { key: "billard", label: "โต๊ะพูล" },
          { key: "private_pool", label: "สระว่ายน้ำส่วนตัว" },
          { key: "extra_bed", label: "เตียงเสริม" },
        ],
        bathrooms: 5,
        bedrooms: 6,
        coverImage: "https://example.supabase.co/storage/v1/object/public/villas/cover.jpg",
        distanceToSea: "-",
        id: "9",
        people: 12,
        poolType: "salt",
        price: 9900,
        title: "บ้านพักสายลม 9",
        zone: "pattaya",
        zoneLabel: "พัทยา",
      },
    ]);
    expect(createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "publishable",
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );
    expect(listings.eq).toHaveBeenCalledWith("is_active", true);
    expect(listings.select).toHaveBeenCalledWith(
      expect.not.stringContaining("listing_facilities"),
    );
    expect(listingFacilities.in).toHaveBeenCalledWith("listing_id", ["listing-9"]);
    expect(images.in).toHaveBeenCalledWith("property_id", [9]);
    expect(listingPrices.in).toHaveBeenCalledWith("listing_id", ["listing-9"]);
  });

  it("keeps listings visible with a null price when listing_prices is empty", async () => {
    mockSupabase({ listingPriceRows: [] });

    await expect(fetchHouseListings()).resolves.toEqual([
      expect.objectContaining({ id: "9", price: null }),
    ]);
  });

  it("uses uploaded cover overrides for public listings", async () => {
    mockCoverOverrides([
      {
        cover_image_url: "https://assets.example.com/villa-cover/9/custom.webp",
        house_id: "9",
      },
    ]);
    const { images } = mockSupabase();

    await expect(fetchHouseListings()).resolves.toEqual([
      expect.objectContaining({
        coverImage: "https://assets.example.com/villa-cover/9/custom.webp",
      }),
    ]);
    expect(images.in).toHaveBeenCalledWith("property_id", [9]);
  });

  it("continues past the first Supabase listings page", async () => {
    const firstPage = Array.from({ length: 1000 }, () => ({
      ...listingRows[0],
      id: null,
      property_id: null,
    }));
    mockSupabase({ listingRowPages: [firstPage, listingRows] as never });

    await expect(fetchHouseListings()).resolves.toEqual([
      expect.objectContaining({ id: "9" }),
    ]);
  });

  it("loads only the homepage listing window for homepage rails", async () => {
    const { listings } = mockSupabase();

    await expect(fetchHomeListings()).resolves.toEqual([
      expect.objectContaining({ id: "9" }),
    ]);
    expect(listings.range).toHaveBeenCalledTimes(1);
    expect(listings.range).toHaveBeenCalledWith(0, 95);
  });

  it("uses the computed homepage listing window", async () => {
    const { listings } = mockSupabase();

    await expect(fetchHomeListings([], 28)).resolves.toEqual([
      expect.objectContaining({ id: "9" }),
    ]);
    expect(listings.range).toHaveBeenCalledWith(0, 27);
  });

  it("also loads configured homepage section houses outside the homepage window", async () => {
    const { listings } = mockSupabase();
    listings.in.mockResolvedValueOnce({
      data: [{ ...listingRows[0], id: "listing-1328", property_id: 1328 }],
      error: null,
    });

    await expect(fetchHomeListings(["1328"])).resolves.toEqual([
      expect.objectContaining({ id: "9" }),
      expect.objectContaining({ id: "1328" }),
    ]);
    expect(listings.in).toHaveBeenCalledWith("property_id", [1328]);
  });

  it("loads search facets without cover images", async () => {
    const { images } = mockSupabase();

    await expect(fetchVillaSearchFacets()).resolves.toEqual({
      maxPrice: 9900,
      zones: [{ label: "พัทยา", value: "pattaya" }],
    });
    expect(images.in).not.toHaveBeenCalled();
  });

  it("loads homepage zones from active listing location_zone values only", async () => {
    const { listingPrices, listings, supabase } = mockSupabase({
      villaZoneRows: [
        { location_zone: "jomtien" },
        { location_zone: "pattaya" },
      ],
    });

    await expect(fetchActiveVillaZones()).resolves.toEqual([
      { label: "จอมเทียน", value: "jomtien" },
      { label: "พัทยา", value: "pattaya" },
    ]);

    expect(supabase.rpc).toHaveBeenCalledWith("get_public_villa_zones");
    expect(listings.select).not.toHaveBeenCalledWith("location_zone");
    expect(listingPrices.in).not.toHaveBeenCalled();
  });

  it("loads the admin card house picker page with lean listing columns", async () => {
    const { images, listingPrices, listings } = mockSupabase();

    await expect(
      fetchVillaCardHouseOptionPage({ page: 1, pageSize: 7, search: "9" }),
    ).resolves.toMatchObject({
      hasMore: false,
      items: [
        {
          coverImage:
            "https://example.supabase.co/storage/v1/object/public/villas/cover.jpg",
          id: "9",
          title: listingRows[0].title,
        },
      ],
      page: 1,
      pageSize: 7,
      total: 1,
    });

    const selectCall = listings.select.mock.calls.find(([columns]) =>
      String(columns).includes("property_id"),
    );
    expect(selectCall?.[0]).not.toContain("listing_facilities");
    expect(selectCall?.[0]).not.toContain("bedrooms");
    expect(selectCall?.[1]).toEqual({ count: "exact" });
    expect(listings.eq).toHaveBeenCalledWith("property_id", 9);
    expect(listings.range).toHaveBeenCalledWith(0, 6);
    expect(images.in).toHaveBeenCalledWith("property_id", [9]);
    expect(listingPrices.in).not.toHaveBeenCalled();
  });

  it("uses uploaded cover overrides in the admin card house picker", async () => {
    mockCoverOverrides([
      {
        cover_image_url: "https://assets.example.com/villa-cover/9/admin.webp",
        house_id: "9",
      },
    ]);
    mockSupabase();

    await expect(
      fetchVillaCardHouseOptionPage({ page: 1, pageSize: 7, search: "9" }),
    ).resolves.toMatchObject({
      items: [
        {
          coverImage: "https://assets.example.com/villa-cover/9/admin.webp",
          id: "9",
        },
      ],
    });
  });

  it("loads a bounded search page with database filters", async () => {
    const { listings } = mockSupabase();

    await expect(
      fetchVillaSearchPage({
        facets: {
          maxPrice: 9900,
          zones: [{ label: "?????", value: "pattaya" }],
        },
        filters: {
          amenities: [],
          bedrooms: 3,
          guests: 8,
          maxPrice: 9900,
          nearSeaOnly: false,
          zone: "pattaya",
        },
        page: 1,
        pageSize: 12,
        sortKey: "recommended",
        villaIdQuery: "9",
      }),
    ).resolves.toMatchObject({
      hasMore: false,
      items: [expect.objectContaining({ id: "9" })],
      page: 1,
      pageSize: 12,
      total: 1,
    });
    expect(listings.gte).toHaveBeenCalledWith("max_guests", 8);
    expect(listings.gte).toHaveBeenCalledWith("bedrooms", 3);
    expect(listings.eq).toHaveBeenCalledWith("location_zone", "pattaya");
    expect(listings.eq).toHaveBeenCalledWith("property_id", 9);
    expect(listings.range).toHaveBeenCalledWith(0, 11);
  });

  it("uses the villa search RPC for price sorting and hydrates only returned ids", async () => {
    const { listings, supabase } = mockSupabase({
      rpcRows: [{ property_id: 9, total_count: 1 }],
    });

    await expect(
      fetchVillaSearchPage({
        facets: {
          maxPrice: 20000,
          zones: [{ label: "?????", value: "pattaya" }],
        },
        filters: {
          amenities: ["wifi"],
          bedrooms: 1,
          guests: 1,
          maxPrice: 12000,
          nearSeaOnly: false,
          zone: "all",
        },
        page: 1,
        pageSize: 12,
        sortKey: "price_asc",
        villaIdQuery: "",
      }),
    ).resolves.toMatchObject({
      hasMore: false,
      items: [expect.objectContaining({ id: "9" })],
      total: 1,
    });
    expect(supabase.rpc).toHaveBeenCalledWith("search_public_villa_ids", {
      p_amenities: ["wifi"],
      p_bedrooms: 1,
      p_guests: 1,
      p_limit: 12,
      p_max_price: 12000,
      p_offset: 0,
      p_query: null,
      p_sort: "price_asc",
      p_zone: "all",
    });
    expect(listings.in).toHaveBeenCalledWith("property_id", [9]);
  });

  it("keeps card amenities when max-price fallback uses lean candidates", async () => {
    const { listings, supabase } = mockSupabase();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST202", message: "missing rpc" },
    } as never);

    const result = await fetchVillaSearchPage({
      facets: {
        maxPrice: 20000,
        zones: [{ label: "?????", value: "pattaya" }],
      },
      filters: {
        amenities: [],
        bedrooms: 1,
        guests: 1,
        maxPrice: 12000,
        nearSeaOnly: false,
        zone: "all",
      },
      page: 1,
      pageSize: 12,
      sortKey: "recommended",
      villaIdQuery: "",
    });

    expect(result.items[0]).toEqual(expect.objectContaining({ id: "9" }));
    expect(result.items[0]?.amenities).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "wifi" })]),
    );
    expect(listings.in).toHaveBeenCalledWith("property_id", [9]);
  });

  it("uses the Supabase catalog for sitemap listings too", async () => {
    mockSupabase();

    await expect(fetchHouseListingsForSitemap()).resolves.toEqual([
      expect.objectContaining({ id: "9" }),
    ]);
    expect(createClientMock).toHaveBeenCalled();
  });

  it("prefers image_zone cover rows before cover_select fallback", async () => {
    mockSupabase({
      imageRows: [
        {
          caption: null,
          cover_select: 9,
          id: 1,
          image_name: null,
          image_url:
            "https://example.supabase.co/storage/v1/object/public/villas/sort-first.jpg",
          image_zone: "outside",
          property_id: 9,
        },
        {
          caption: null,
          cover_select: 0,
          id: 2,
          image_name: null,
          image_url:
            "https://example.supabase.co/storage/v1/object/public/villas/zone-cover.jpg",
          image_zone: "cover",
          property_id: 9,
        },
      ] as unknown as typeof imageRows,
    });

    await expect(fetchHouseListings()).resolves.toEqual([
      expect.objectContaining({
        coverImage:
          "https://example.supabase.co/storage/v1/object/public/villas/zone-cover.jpg",
      }),
    ]);
  });

  it("uses the newest cover-zone row when cover_select values tie", async () => {
    mockSupabase({
      imageRows: [
        {
          caption: null,
          cover_select: 0,
          id: 133301,
          image_name: "old-cover.jpg",
          image_url:
            "https://s3.ap-southeast-1.amazonaws.com/poolvillas.co.ltd/old-cover.jpg",
          image_zone: "cover",
          property_id: 9,
        },
        {
          caption: null,
          cover_select: 0,
          id: 144651,
          image_name: "new-cover.webp",
          image_url:
            "https://webook-media.poolvilla.workers.dev/houses/9/new-cover.webp",
          image_zone: "cover",
          property_id: 9,
        },
      ],
    });

    await expect(fetchHouseListings()).resolves.toEqual([
      expect.objectContaining({
        coverImage:
          "https://webook-media.poolvilla.workers.dev/houses/9/new-cover.webp",
      }),
    ]);
  });
});
describe("fetchVillaDetail", () => {
  it("keeps Supabase detail values while filling missing fields from Deville Central", async () => {
    const listing = {
      amenities: [],
      bathrooms: 5,
      bedrooms: 6,
      coverImage: null,
      distanceToSea: "-",
      id: "9",
      people: 12,
      poolType: "salt",
      price: 0,
      zone: "pattaya",
      zoneLabel: "pattaya",
    };
    mockSupabase();
    vi.stubEnv("DEVILLE_BEARER_TOKEN", "secret-token");
    const upstreamDetail = {
      ...devilleDetail,
      h_rule: "No parties after midnight",
      h_time_checkin: "15:00:00",
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(upstreamDetail), { status: 200 }));

    const payload = await fetchVillaDetail("9", [listing]);

    expect(payload).toMatchObject({
      detail: expect.objectContaining({
        h_rule: "No parties after midnight",
        h_time_checkin: "14:00:00",
      }),
      detailStatus: "available",
      listing,
    });
    expect(JSON.stringify(payload)).not.toContain("secret-token");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        href: "https://deville-central.com/api/getAccommodation.php?hid=9",
      }),
      {
        headers: {
          Authorization: "Bearer secret-token",
        },
      },
    );
    expect(unstableCacheMock).toHaveBeenCalledWith(expect.any(Function), [
      CACHE_TAGS.villaDetail("9"),
    ], {
      revalidate: CACHE_REVALIDATE_SECONDS.villaDetail,
      tags: [CACHE_TAGS.villaDetails, CACHE_TAGS.villaDetail("9")],
    });
  });

  it("falls back to Supabase detail fields when the Deville token is missing", async () => {
    const listing = {
      amenities: [],
      bathrooms: 5,
      bedrooms: 6,
      coverImage: null,
      distanceToSea: "-",
      id: "9",
      people: 12,
      poolType: "salt",
      price: 0,
      zone: "pattaya",
      zoneLabel: "pattaya",
    };
    mockSupabase();

    await expect(fetchVillaDetail("9", [listing])).resolves.toEqual({
      detail: {
        h_additional_costs: "No smoking",
        h_extra: 500,
        h_insurance: 3000,
        h_moredetail: "Large family villa",
        h_people_max: 12,
        h_time_checkin: "14:00:00",
        h_time_checkout: "11:00:00",
      },
      detailStatus: "missing_token",
      listing,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to Supabase detail fields when Deville Central fails", async () => {
    const listing = {
      amenities: [],
      bathrooms: 5,
      bedrooms: 6,
      coverImage: null,
      distanceToSea: "-",
      id: "9",
      people: 12,
      poolType: "salt",
      price: 0,
      zone: "pattaya",
      zoneLabel: "pattaya",
    };
    mockSupabase();
    vi.stubEnv("DEVILLE_BEARER_TOKEN", "secret-token");
    fetchMock.mockResolvedValue(new Response("upstream down", { status: 503 }));

    await expect(fetchVillaDetail("9", [listing])).resolves.toMatchObject({
      detail: {
        h_additional_costs: "No smoking",
        h_moredetail: "Large family villa",
      },
      detailStatus: "unavailable",
      listing,
    });
  });

  it("returns null when no listing exists for the requested id", async () => {
    mockSupabase({ listingRows: [] });

    await expect(fetchVillaDetail("999")).resolves.toBeNull();
  });
});

describe("fetchVillaPageData", () => {
  it("starts loading initial gallery images before villa detail finishes", async () => {
    mockSupabase();
    vi.stubEnv("DEVILLE_BEARER_TOKEN", "secret-token");
    let resolveDetailResponse: (response: Response) => void = () => {};
    const detailResponse = new Promise<Response>((resolve) => {
      resolveDetailResponse = resolve;
    });
    fetchMock.mockReturnValue(detailResponse);

    const dataPromise = fetchVillaPageData("9");

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(fetchVillaImagesMock).toHaveBeenCalledWith("9");

    resolveDetailResponse(
      new Response(JSON.stringify(devilleDetail), { status: 200 }),
    );
    await expect(dataPromise).resolves.toMatchObject({
      payload: { listing: { id: "9" } },
    });
  });

  it("returns every server-fetched gallery image through its same-origin id route", async () => {
    mockSupabase();
    vi.stubEnv("DEVILLE_BEARER_TOKEN", "secret-token");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(devilleDetail), { status: 200 }),
    );
    fetchVillaImagesMock.mockResolvedValue([
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
        detail: devilleDetail,
        listing: { id: "9" },
        detailStatus: "available",
      },
      recommendedSection: null,
    });
    expect(fetchVillaImagesMock).toHaveBeenCalledWith("9");
    expect(data?.initialGalleryImages).toHaveLength(5);
    expect(data?.initialGalleryLoadFailed).toBe(false);
    expect(data?.initialGalleryImages.map((image) => image.imageUrl)).toEqual([
      "/api/villas/9/images?imageId=1",
      "/api/villas/9/images?imageId=2",
      "/api/villas/9/images?imageId=3",
      "/api/villas/9/images?imageId=4",
      "/api/villas/9/images?imageId=5",
    ]);
    expect(JSON.stringify(data?.initialGalleryImages)).not.toContain(
      "images.example.com",
    );
    expect(data?.payload.listing.coverImage).toBe("/api/houses/images/9");
  });

  it("keeps the detail payload when the gallery dependency fails", async () => {
    mockSupabase();
    vi.stubEnv("DEVILLE_BEARER_TOKEN", "secret-token");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(devilleDetail), { status: 200 }),
    );
    fetchVillaImagesMock.mockRejectedValueOnce(
      new Error("gallery unavailable"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(fetchVillaPageData("9")).resolves.toMatchObject({
      initialGalleryImages: [],
      initialGalleryLoadFailed: true,
      payload: expect.any(Object),
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Unable to load villa detail gallery images",
      expect.objectContaining({ message: "gallery unavailable" }),
    );
  });
});
