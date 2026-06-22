import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { unstable_cache } from "next/cache";
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

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

const { fetchVillaPreviewImagesMock } = vi.hoisted(() => ({
  fetchVillaPreviewImagesMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

vi.mock("../images", async () => {
  const actual = await vi.importActual<typeof import("../images")>("../images");

  return {
    ...actual,
    fetchVillaPreviewImages: fetchVillaPreviewImagesMock,
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

const devilleDetail = {
  h_bedroom_detail: "Bedroom 1: king bed",
  h_kitchen_ware: "Microwave\nThai kitchen equipment",
  h_swimmingpool: "3.5 x 8 m salt pool",
  location: "Jomtien, Pattaya",
  sea: "900 m",
};

function listingQuery(data = listingRows, error: unknown = null) {
  const query = {
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(() =>
      Promise.resolve({ data: data[0] ?? null, error }),
    ),
    order: vi.fn(() => Promise.resolve({ data, error })),
    select: vi.fn(() => query),
  };

  return query;
}

function imagesQuery(data = imageRows, error: unknown = null) {
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

function mockSupabase(options?: {
  imageRows?: typeof imageRows;
  listingPriceRows?: typeof listingPriceRows;
  listingError?: unknown;
  listingRows?: typeof listingRows;
}) {
  const listings = listingQuery(options?.listingRows ?? listingRows, options?.listingError);
  const images = imagesQuery(options?.imageRows ?? imageRows);
  const listingPrices = listingPricesQuery(
    options?.listingPriceRows ?? listingPriceRows,
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

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  createClientMock.mockReturnValue(supabase);

  return { images, listingPrices, listings, supabase };
}

afterEach(() => {
  createClientMock.mockReset();
  fetchMock.mockReset();
  fetchVillaPreviewImagesMock.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable");
  vi.stubGlobal("fetch", fetchMock);
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

  it("loads active Supabase listings with facilities and cover images", async () => {
    const { images, listingPrices, listings } = mockSupabase();

    await expect(fetchHouseListings()).resolves.toEqual([
      {
        amenities: [
          { key: "wifi", label: "Wi-Fi" },
          { key: "karaoke", label: "Karaoke" },
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
    expect(images.in).toHaveBeenCalledWith("property_id", [9]);
    expect(listingPrices.in).toHaveBeenCalledWith("listing_id", ["listing-9"]);
  });

  it("keeps listings visible with a null price when listing_prices is empty", async () => {
    mockSupabase({ listingPriceRows: [] });

    await expect(fetchHouseListings()).resolves.toEqual([
      expect.objectContaining({ id: "9", price: null }),
    ]);
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
      ],
    });

    await expect(fetchHouseListings()).resolves.toEqual([
      expect.objectContaining({
        coverImage:
          "https://example.supabase.co/storage/v1/object/public/villas/zone-cover.jpg",
      }),
    ]);
  });
});

describe("fetchVillaDetail", () => {
  it("returns Deville Central detail fields for the requested listing", async () => {
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
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(devilleDetail), { status: 200 }),
    );

    const payload = await fetchVillaDetail("9", [listing]);

    expect(payload).toEqual({
      detail: devilleDetail,
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
  it("returns server-fetched detail payload with up to four initial gallery images", async () => {
    mockSupabase();
    vi.stubEnv("DEVILLE_BEARER_TOKEN", "secret-token");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(devilleDetail), { status: 200 }),
    );
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
        detail: devilleDetail,
        listing: { id: "9" },
        detailStatus: "available",
      },
      recommendedSection: null,
    });
    expect(data?.initialGalleryImages).toHaveLength(4);
    expect(data?.payload.listing.coverImage).toBe(
      "https://example.supabase.co/storage/v1/object/public/villas/cover.jpg",
    );
    expect(fetchVillaPreviewImagesMock).toHaveBeenCalledWith("9");
  });
});
