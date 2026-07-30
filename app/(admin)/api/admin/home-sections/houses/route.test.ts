import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import {
  fetchHouseListings,
  fetchVillaCardHouseOptionPage,
} from "@/lib/villas/server";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/admin/route-helpers", () => ({
  requireHomeConfigAdmin: vi.fn(),
}));

vi.mock("@/lib/villas/server", () => ({
  fetchHouseListings: vi.fn(),
  fetchVillaCardHouseOptionPage: vi.fn(),
}));

const requireHomeConfigAdminMock = vi.mocked(requireHomeConfigAdmin);
const fetchHouseListingsMock = vi.mocked(fetchHouseListings);
const fetchVillaCardHouseOptionPageMock = vi.mocked(
  fetchVillaCardHouseOptionPage,
);

function getRequest(query: string) {
  return new Request(
    `https://example.com/api/admin/home-sections/houses?${query}`,
    { headers: { authorization: "Bearer token" } },
  );
}

describe("admin home section houses route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireHomeConfigAdminMock.mockResolvedValue({
      ok: true,
      supabase: {},
    } as Awaited<ReturnType<typeof requireHomeConfigAdmin>>);
  });

  it("returns the custom cover resolved for selected manual house ids", async () => {
    fetchHouseListingsMock.mockResolvedValue([
      {
        amenities: [],
        bathrooms: 3,
        bedrooms: 4,
        coverImage: "https://cdn.example.com/custom-cover-105.jpg",
        distanceToSea: "500m",
        id: "105",
        people: 10,
        poolType: "private",
        price: 8900,
        zone: "jomtien",
        zoneLabel: "Jomtien",
      },
    ]);

    const { GET } = await import("./route");
    const response = await GET(getRequest("ids=105"));

    await expect(response.json()).resolves.toEqual({
      houses: [
        {
          coverImage: "https://cdn.example.com/custom-cover-105.jpg",
          id: "105",
          title: "บ้าน 105",
        },
      ],
    });
  });

  it("returns the legacy cover when no custom cover is resolved", async () => {
    fetchVillaCardHouseOptionPageMock.mockResolvedValue({
      hasMore: false,
      items: [
        {
          coverImage: "https://legacy.example.com/cover-702.jpg",
          id: "702",
          title: "Villa DV-702",
          zoneLabel: "Jomtien",
        },
      ],
      page: 1,
      pageSize: 10,
      total: 1,
    });

    const { GET } = await import("./route");
    const response = await GET(getRequest("search=702"));

    await expect(response.json()).resolves.toEqual({
      houses: [
        {
          coverImage: "https://legacy.example.com/cover-702.jpg",
          id: "702",
          title: "Villa DV-702",
        },
      ],
    });
  });
});
