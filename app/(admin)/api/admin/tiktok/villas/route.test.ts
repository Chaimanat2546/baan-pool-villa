import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import { fetchHouseListings } from "@/lib/villas/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/route-helpers", () => ({ requireHomeConfigAdmin: vi.fn() }));
vi.mock("@/lib/villas/server", () => ({ fetchHouseListings: vi.fn() }));

const requireHomeConfigAdminMock = vi.mocked(requireHomeConfigAdmin);
const fetchHouseListingsMock = vi.mocked(fetchHouseListings);

describe("admin TikTok villa search route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireHomeConfigAdminMock.mockResolvedValue({
      ok: true,
      supabase: {},
    } as Awaited<ReturnType<typeof requireHomeConfigAdmin>>);
  });

  it("returns bounded title-or-ID matches to an authenticated admin", async () => {
    fetchHouseListingsMock.mockResolvedValue([
      {
        amenities: [],
        bathrooms: 2,
        bedrooms: 3,
        coverImage: null,
        distanceToSea: "500m",
        id: "501",
        people: 8,
        poolType: "private",
        price: 5000,
        title: "Glass House B8",
        zone: "jomtien",
        zoneLabel: "Jomtien",
      },
    ]);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("https://example.test/api/admin/tiktok/villas?q=glass"),
    );

    await expect(response.json()).resolves.toEqual({
      villas: [{ id: "501", title: "Glass House B8" }],
    });
  });

  it("rejects an overlong query without reading the catalog", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request(`https://example.test/api/admin/tiktok/villas?q=${"x".repeat(81)}`),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toHaveProperty("error");
    expect(fetchHouseListingsMock).not.toHaveBeenCalled();
  });

  it("returns a structured Thai error when the villa catalog is unavailable", async () => {
    fetchHouseListingsMock.mockRejectedValue(new Error("catalog offline"));

    const { GET } = await import("./route");
    const response = await GET(
      new Request("https://example.test/api/admin/tiktok/villas?q=glass"),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("ไม่สามารถ"),
    });
  });

  it("returns the shared auth response without reading the catalog", async () => {
    const denied = Response.json({ error: "Missing bearer token." }, { status: 401 });
    requireHomeConfigAdminMock.mockResolvedValue({ ok: false, response: denied });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("https://example.test/api/admin/tiktok/villas?q=glass"),
    );

    expect(response).toBe(denied);
    expect(fetchHouseListingsMock).not.toHaveBeenCalled();
  });
});
