import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  PUBLIC_RATE_LIMIT_POLICIES,
  resetPublicRateLimitForTests,
} from "@/lib/api/rate-limit";

const {
  fetchHouseListingsMock,
  fetchVillaSearchPageMock,
  fetchVillaBookingCalendarMock,
  fetchVillaDetailMock,
} = vi.hoisted(() => ({
  fetchHouseListingsMock: vi.fn(),
  fetchVillaSearchPageMock: vi.fn(),
  fetchVillaBookingCalendarMock: vi.fn(),
  fetchVillaDetailMock: vi.fn(),
}));

vi.mock("@/lib/villas/booking-calendar", () => ({
  fetchVillaBookingCalendar: fetchVillaBookingCalendarMock,
  isValidBookingCalendarMonth: (month: string) =>
    /^\d{4}-(0[1-9]|1[0-2])$/.test(month),
}));

vi.mock("@/lib/villas/server", () => ({
  fetchHouseListings: fetchHouseListingsMock,
  fetchVillaSearchPage: fetchVillaSearchPageMock,
  fetchVillaDetail: fetchVillaDetailMock,
}));

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  resetPublicRateLimitForTests();
  fetchVillaBookingCalendarMock.mockReset();
  fetchHouseListingsMock.mockReset();
  fetchVillaSearchPageMock.mockReset();
  fetchVillaDetailMock.mockReset();
});

async function expectRateLimitResponse(response: Response) {
  const retryAfterHeader = response.headers.get("Retry-After");
  expect(retryAfterHeader).not.toBeNull();

  const retryAfterSeconds = Number(retryAfterHeader);
  expect(retryAfterSeconds).toBeGreaterThanOrEqual(59);
  expect(retryAfterSeconds).toBeLessThanOrEqual(60);
  await expect(response.json()).resolves.toEqual({
    error: "Too many requests.",
    retryAfterSeconds,
  });
}

describe("GET /api/houses", () => {
  it("returns a bounded first page of the public catalog with a six-hour cache header", async () => {
    const listings = Array.from({ length: 30 }, (_, index) => ({
      amenities: [],
      bathrooms: 3,
      bedrooms: 4,
      coverImage: `https://devillegroups.com/imgs/profile_imgs_large/${index + 1}.jpg`,
      distanceToSea: "1 km",
      id: String(index + 1),
      people: 8,
      poolType: "private",
      price: 10000 + index,
      zone: "jomtien",
      zoneLabel: "Jomtien",
    }));
    fetchVillaSearchPageMock.mockResolvedValue({
      facets: { maxPrice: 11000, zones: [{ label: "Jomtien", value: "jomtien" }] },
      hasMore: true,
      items: listings.slice(0, 12),
      page: 1,
      pageSize: 12,
      total: 30,
    });

    const { GET } = await import("../../../app/(public)/api/houses/route");
    const response = await GET(new Request("https://example.com/api/houses"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=21600, stale-while-revalidate=21600",
    );
    expect(body).toMatchObject({
      hasMore: true,
      page: 1,
      pageSize: 12,
      total: 30,
    });
    expect(body.items).toHaveLength(12);
    expect(body.items[0]).toEqual({
      ...listings[0],
      coverImage: "/api/houses/images/1",
    });
  });

  it("filters, sorts, and clamps public catalog page sizes", async () => {
    const items = [
      {
        amenities: [],
        bathrooms: 2,
        bedrooms: 2,
        coverImage: null,
        distanceToSea: "1 km",
        id: "1",
        people: 4,
        poolType: "private",
        price: 9000,
        zone: "jomtien",
        zoneLabel: "Jomtien",
      },
      {
        amenities: [],
        bathrooms: 3,
        bedrooms: 4,
        coverImage: null,
        distanceToSea: "1 km",
        id: "2",
        people: 10,
        poolType: "private",
        price: 18000,
        zone: "jomtien",
        zoneLabel: "Jomtien",
      },
      {
        amenities: [],
        bathrooms: 4,
        bedrooms: 5,
        coverImage: null,
        distanceToSea: "1 km",
        id: "3",
        people: 12,
        poolType: "private",
        price: 15000,
        zone: "pattaya",
        zoneLabel: "Pattaya",
      },
    ];
    fetchVillaSearchPageMock.mockResolvedValue({
      facets: { maxPrice: 18000, zones: [{ label: "Jomtien", value: "jomtien" }] },
      hasMore: false,
      items: [items[1]],
      page: 1,
      pageSize: 24,
      total: 1,
    });

    const { GET } = await import("../../../app/(public)/api/houses/route");
    const response = await GET(
      new Request(
        "https://example.com/api/houses?zone=jomtien&guests=8&bedrooms=3&sort=price_desc&limit=999",
      ),
    );
    const body = await response.json();

    expect(body).toMatchObject({
      hasMore: false,
      page: 1,
      pageSize: 24,
      total: 1,
    });
    expect(body.items).toEqual([
      expect.objectContaining({
        id: "2",
        price: 18000,
      }),
    ]);
    expect(fetchVillaSearchPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          bedrooms: 3,
          guests: 8,
          zone: "jomtien",
        }),
        pageSize: 24,
        sortKey: "price_desc",
      }),
    );
  });

  it("searches catalog pages by title through the id query param", async () => {
    const partyListing = {
      amenities: [],
      bathrooms: 3,
      bedrooms: 4,
      coverImage: null,
      distanceToSea: "1 km",
      id: "2",
      people: 10,
      poolType: "private",
      price: 18000,
      title: "Jomtien Party House",
      zone: "jomtien",
      zoneLabel: "Jomtien",
    };
    fetchVillaSearchPageMock.mockResolvedValue({
      facets: { maxPrice: 18000, zones: [{ label: "Jomtien", value: "jomtien" }] },
      hasMore: false,
      items: [partyListing],
      page: 1,
      pageSize: 12,
      total: 1,
    });

    const { GET } = await import("../../../app/(public)/api/houses/route");
    const response = await GET(new Request("https://example.com/api/houses?id=party"));
    const body = await response.json();

    expect(body).toMatchObject({ total: 1 });
    expect(body.items).toEqual([expect.objectContaining({ id: "2" })]);
    expect(fetchVillaSearchPageMock).toHaveBeenCalledWith(
      expect.objectContaining({ villaIdQuery: "party" }),
    );
  });

  it("returns a generic 502 error and logs backend failures", async () => {
    const rawError = new Error("secret listing backend detail");
    fetchVillaSearchPageMock.mockRejectedValue(rawError);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { GET } = await import("../../../app/(public)/api/houses/route");
    const response = await GET(new Request("https://example.com/api/houses"));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: "Unable to load houses" });
    expect(JSON.stringify(body)).not.toContain("secret listing backend detail");
    expect(consoleError).toHaveBeenCalledWith("Unable to load houses", rawError);
  });

  it("rate limits repeated catalog requests before loading listings", async () => {
    fetchVillaSearchPageMock.mockResolvedValue({
      facets: { maxPrice: 1000, zones: [] },
      hasMore: false,
      items: [],
      page: 1,
      pageSize: 12,
      total: 0,
    });
    const { GET } = await import("../../../app/(public)/api/houses/route");
    const request = new Request("https://example.com/api/houses", {
      headers: { "CF-Connecting-IP": "203.0.113.70" },
    });

    for (
      let index = 0;
      index < PUBLIC_RATE_LIMIT_POLICIES.publicCatalog.limit;
      index += 1
    ) {
      const response = await GET(request);
      expect(response.status).not.toBe(429);
    }

    fetchHouseListingsMock.mockClear();
    fetchVillaSearchPageMock.mockClear();
    const blocked = await GET(request);

    expect(blocked.status).toBe(429);
    await expectRateLimitResponse(blocked);
    expect(blocked.headers.get("Cache-Control")).toBe("no-store");
    expect(fetchHouseListingsMock).not.toHaveBeenCalled();
    expect(fetchVillaSearchPageMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/villas/[id]", () => {
  it("returns public detail data without exposing cover image sources", async () => {
    fetchVillaDetailMock.mockResolvedValue({
      detail: null,
      detailStatus: "missing_token",
      listing: {
        amenities: [],
        bathrooms: 3,
        bedrooms: 4,
        coverImage: "https://devillegroups.com/imgs/profile_imgs_large/9.jpg",
        distanceToSea: "1 km",
        id: "9",
        people: 8,
        poolType: "private",
        price: 12000,
        zone: "jomtien",
        zoneLabel: "Jomtien",
      },
    });

    const { GET } = await import("../../../app/(public)/api/villas/[id]/route");
    const response = await GET(new Request("https://example.com/api/villas/9"), {
      params: Promise.resolve({ id: "9" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.listing.coverImage).toBe("/api/houses/images/9");
  });

  it("rate limits repeated detail requests before loading villa detail", async () => {
    const { GET } = await import("../../../app/(public)/api/villas/[id]/route");
    const request = new Request("https://example.com/api/villas/9", {
      headers: { "CF-Connecting-IP": "203.0.113.80" },
    });
    const context = { params: Promise.resolve({ id: "9" }) };

    for (
      let index = 0;
      index < PUBLIC_RATE_LIMIT_POLICIES.publicDetail.limit;
      index += 1
    ) {
      const response = await GET(request, context);
      expect(response.status).not.toBe(429);
    }

    fetchVillaDetailMock.mockClear();
    const blocked = await GET(request, context);

    expect(blocked.status).toBe(429);
    await expectRateLimitResponse(blocked);
    expect(fetchVillaDetailMock).not.toHaveBeenCalled();
  });

  it("returns a generic 502 error and logs backend failures", async () => {
    const rawError = new Error("secret villa backend detail");
    fetchVillaDetailMock.mockRejectedValue(rawError);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { GET } = await import("../../../app/(public)/api/villas/[id]/route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ id: "9" }),
    });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: "Unable to load villa" });
    expect(JSON.stringify(body)).not.toContain("secret villa backend detail");
    expect(consoleError).toHaveBeenCalledWith("Unable to load villa", rawError);
  });

  it("returns 404 when the villa does not exist", async () => {
    fetchVillaDetailMock.mockResolvedValue(null);

    const { GET } = await import("../../../app/(public)/api/villas/[id]/route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ id: "9" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Villa not found" });
  });
});

describe("GET /api/villas/[id]/booking-calendar", () => {
  it("rate limits repeated calendar requests before loading booking data", async () => {
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/booking-calendar/route"
    );
    const request = new Request(
      "https://example.com/api/villas/9/booking-calendar?month=2026-06",
      { headers: { "CF-Connecting-IP": "203.0.113.81" } },
    );
    const context = { params: Promise.resolve({ id: "9" }) };

    for (
      let index = 0;
      index < PUBLIC_RATE_LIMIT_POLICIES.publicCalendar.limit;
      index += 1
    ) {
      fetchVillaBookingCalendarMock.mockResolvedValue({
        calendar: { days: {}, month: "2026-06", status: "available" },
        status: "available",
      });
      const response = await GET(request, context);
      expect(response.status).not.toBe(429);
    }

    fetchVillaBookingCalendarMock.mockClear();
    const blocked = await GET(request, context);

    expect(blocked.status).toBe(429);
    await expectRateLimitResponse(blocked);
    expect(fetchVillaBookingCalendarMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid month parameters before calling the booking API", async () => {
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/booking-calendar/route"
    );
    const response = await GET(
      new Request(
        "https://example.com/api/villas/9/booking-calendar?month=2026-13",
      ),
      { params: Promise.resolve({ id: "9" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid month.",
    });
    expect(fetchVillaBookingCalendarMock).not.toHaveBeenCalled();
  });

  it("rate limits invalid month requests before validation reaches the booking API", async () => {
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/booking-calendar/route"
    );
    const request = new Request(
      "https://example.com/api/villas/9/booking-calendar?month=2026-13",
      { headers: { "CF-Connecting-IP": "203.0.113.82" } },
    );
    const context = { params: Promise.resolve({ id: "9" }) };

    for (
      let index = 0;
      index < PUBLIC_RATE_LIMIT_POLICIES.publicCalendar.limit;
      index += 1
    ) {
      const response = await GET(request, context);
      expect(response.status).toBe(400);
    }

    const blocked = await GET(request, context);

    expect(blocked.status).toBe(429);
    await expectRateLimitResponse(blocked);
    expect(fetchVillaBookingCalendarMock).not.toHaveBeenCalled();
  });

  it("returns calendar data with the villa detail cache header", async () => {
    fetchVillaBookingCalendarMock.mockResolvedValue({
      calendar: {
        days: {
          "2026-06-16": {
            disabled: false,
            icons: [],
            kind: "promotion",
            label: "โปรโมชั่น",
            price: 7900,
            tone: "promotion",
          },
        },
        month: "2026-06",
        status: "available",
      },
      status: "available",
    });

    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/booking-calendar/route"
    );
    const response = await GET(
      new Request(
        "https://example.com/api/villas/9/booking-calendar?month=2026-06",
      ),
      { params: Promise.resolve({ id: "9" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=900",
    );
    expect(fetchVillaBookingCalendarMock).toHaveBeenCalledWith("9", "2026-06");
    expect(body).toMatchObject({
      days: {
        "2026-06-16": {
          kind: "promotion",
          price: 7900,
        },
      },
      month: "2026-06",
      status: "available",
    });
  });

  it("returns six consecutive calendar months in one response", async () => {
    fetchVillaBookingCalendarMock.mockImplementation(
      async (_id: string, month: string) => ({
        calendar: { days: {}, month, status: "available" },
        status: "available",
      }),
    );

    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/booking-calendar/route"
    );
    const response = await GET(
      new Request(
        "https://example.com/api/villas/9/booking-calendar?month=2026-10&months=6",
      ),
      { params: Promise.resolve({ id: "9" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=900",
    );
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ month: "2026-10" }),
      expect.objectContaining({ month: "2026-11" }),
      expect.objectContaining({ month: "2026-12" }),
      expect.objectContaining({ month: "2027-01" }),
      expect.objectContaining({ month: "2027-02" }),
      expect.objectContaining({ month: "2027-03" }),
    ]);
    expect(fetchVillaBookingCalendarMock.mock.calls).toEqual([
      ["9", "2026-10"],
      ["9", "2026-11"],
      ["9", "2026-12"],
      ["9", "2027-01"],
      ["9", "2027-02"],
      ["9", "2027-03"],
    ]);
  });

  it("rejects unsupported booking calendar batch sizes", async () => {
    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/booking-calendar/route"
    );
    const response = await GET(
      new Request(
        "https://example.com/api/villas/9/booking-calendar?month=2026-06&months=5",
      ),
      { params: Promise.resolve({ id: "9" }) },
    );

    expect(response.status).toBe(400);
    expect(fetchVillaBookingCalendarMock).not.toHaveBeenCalled();
  });

  it("returns 503 when the server booking token is missing", async () => {
    fetchVillaBookingCalendarMock.mockResolvedValue({
      calendar: null,
      status: "missing_token",
    });

    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/booking-calendar/route"
    );
    const response = await GET(
      new Request(
        "https://example.com/api/villas/9/booking-calendar?month=2026-06",
      ),
      { params: Promise.resolve({ id: "9" }) },
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Booking calendar is not configured.",
    });
  });

  it("returns no-store for transient unavailable booking calendar responses", async () => {
    fetchVillaBookingCalendarMock.mockResolvedValue({
      calendar: null,
      status: "unavailable",
    });

    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/booking-calendar/route"
    );
    const response = await GET(
      new Request(
        "https://example.com/api/villas/9/booking-calendar?month=2026-06",
      ),
      { params: Promise.resolve({ id: "9" }) },
    );

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Booking calendar is unavailable.",
    });
  });

  it("returns a generic 502 error and logs backend failures", async () => {
    const rawError = new Error("secret booking backend detail");
    fetchVillaBookingCalendarMock.mockRejectedValue(rawError);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { GET } = await import(
      "../../../app/(public)/api/villas/[id]/booking-calendar/route"
    );
    const response = await GET(
      new Request(
        "https://example.com/api/villas/9/booking-calendar?month=2026-06",
      ),
      { params: Promise.resolve({ id: "9" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: "Unable to load booking calendar" });
    expect(JSON.stringify(body)).not.toContain("secret booking backend detail");
    expect(consoleError).toHaveBeenCalledWith(
      "Unable to load booking calendar",
      rawError,
    );
  });
});
