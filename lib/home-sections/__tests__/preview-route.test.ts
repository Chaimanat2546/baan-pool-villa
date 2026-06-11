import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import { fetchHouseListings } from "@/lib/villas/server";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/admin/route-helpers", () => ({
  requireHomeConfigAdmin: vi.fn(),
}));

vi.mock("@/lib/villas/server", () => ({
  fetchHouseListings: vi.fn(),
}));

const requireHomeConfigAdminMock = vi.mocked(requireHomeConfigAdmin);
const fetchHouseListingsMock = vi.mocked(fetchHouseListings);

function postRequest(body: unknown) {
  return new Request("https://example.com/api/admin/home-sections/preview", {
    body: JSON.stringify(body),
    headers: {
      authorization: "Bearer token",
      "content-type": "application/json",
    },
    method: "POST",
  });
}

function invalidJsonPostRequest() {
  return new Request("https://example.com/api/admin/home-sections/preview", {
    body: "{",
    headers: {
      authorization: "Bearer token",
      "content-type": "application/json",
    },
    method: "POST",
  });
}

describe("admin home sections preview route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireHomeConfigAdminMock.mockResolvedValue({
      ok: true,
      supabase: {},
    } as Awaited<ReturnType<typeof requireHomeConfigAdmin>>);
  });

  it("validates manual house ids without returning real listing data", async () => {
    fetchHouseListingsMock.mockResolvedValue([
      {
        amenities: [],
        bathrooms: 3,
        bedrooms: 4,
        coverImage: "https://devillegroups.com/imgs/profile_imgs_large/105.jpg",
        distanceToSea: "500m",
        id: "105",
        people: 10,
        poolType: "private",
        price: 8900,
        zone: "jomtien",
        zoneLabel: "Jomtien",
      },
    ]);

    const { POST } = await import(
      "../../../app/(admin)/api/admin/home-sections/preview/route"
    );
    const response = await POST(
      postRequest({ houseIds: ["105", "999", "bad-id", "105"] }),
    );
    const payload = await response.json();
    const serializedPayload = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      validIds: ["105"],
      missingIds: ["999"],
      invalidIds: ["bad-id"],
    });
    expect(serializedPayload).not.toContain("coverImage");
    expect(serializedPayload).not.toContain("zoneLabel");
    expect(serializedPayload).not.toContain("price");
    expect(serializedPayload).not.toContain("people");
    expect(serializedPayload).not.toContain("bedrooms");
    expect(serializedPayload).not.toContain("devillegroups.com");
  });

  it("rejects invalid JSON before loading villa listings", async () => {
    const { POST } = await import(
      "../../../app/(admin)/api/admin/home-sections/preview/route"
    );
    const response = await POST(invalidJsonPostRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: ["Request body must be JSON."],
    });
    expect(fetchHouseListingsMock).not.toHaveBeenCalled();
  });
});
