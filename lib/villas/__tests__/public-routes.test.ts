import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  PUBLIC_RATE_LIMIT_POLICIES,
  resetPublicRateLimitForTests,
} from "@/lib/api/rate-limit";

const { fetchHouseListingsMock, fetchVillaDetailMock } = vi.hoisted(() => ({
  fetchHouseListingsMock: vi.fn(),
  fetchVillaDetailMock: vi.fn(),
}));

vi.mock("@/lib/villas/server", () => ({
  fetchHouseListings: fetchHouseListingsMock,
  fetchVillaDetail: fetchVillaDetailMock,
}));

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  resetPublicRateLimitForTests();
  fetchHouseListingsMock.mockReset();
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
      coverImage: null,
      distanceToSea: "1 km",
      id: String(index + 1),
      people: 8,
      poolType: "private",
      price: 10000 + index,
      zone: "jomtien",
      zoneLabel: "Jomtien",
    }));
    fetchHouseListingsMock.mockResolvedValue(listings);

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
    expect(body.items[0]).toEqual(listings[0]);
  });

  it("filters, sorts, and clamps public catalog page sizes", async () => {
    fetchHouseListingsMock.mockResolvedValue([
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
    ]);

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
  });

  it("returns a generic 502 error and logs backend failures", async () => {
    const rawError = new Error("secret listing backend detail");
    fetchHouseListingsMock.mockRejectedValue(rawError);
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
    const blocked = await GET(request);

    expect(blocked.status).toBe(429);
    await expectRateLimitResponse(blocked);
    expect(blocked.headers.get("Cache-Control")).toBe("no-store");
    expect(fetchHouseListingsMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/villas/[id]", () => {
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
