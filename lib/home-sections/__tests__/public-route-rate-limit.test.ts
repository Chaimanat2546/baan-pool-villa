import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PUBLIC_RATE_LIMIT_POLICIES,
  resetPublicRateLimitForTests,
} from "@/lib/api/rate-limit";
import {
  getHomeSectionListingPlan,
  getResolvedHomeSections,
} from "@/lib/home-sections/server";
import { fetchHouseListings } from "@/lib/villas/server";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/villas/server", () => ({
  fetchHouseListings: vi.fn(),
}));

vi.mock("@/lib/home-sections/server", () => ({
  getHomeSectionListingPlan: vi.fn(),
  getResolvedHomeSections: vi.fn(),
}));

const fetchHouseListingsMock = vi.mocked(fetchHouseListings);
const getHomeSectionListingPlanMock = vi.mocked(getHomeSectionListingPlan);
const getResolvedHomeSectionsMock = vi.mocked(getResolvedHomeSections);

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  resetPublicRateLimitForTests();
  fetchHouseListingsMock.mockReset();
  getHomeSectionListingPlanMock.mockReset();
  getResolvedHomeSectionsMock.mockReset();
});

describe("GET /api/home-sections", () => {
  it("rate limits repeated catalog requests before resolving sections", async () => {
    getHomeSectionListingPlanMock.mockResolvedValue({
      configs: [],
      houseIds: [],
      layout: {
        degraded: false,
        items: [],
        source: "config",
      },
      listingLimit: 0,
    });
    fetchHouseListingsMock.mockResolvedValue([]);
    getResolvedHomeSectionsMock.mockResolvedValue({
      degraded: false,
      sections: [],
      source: "config",
    });
    const { GET } = await import(
      "../../../app/(public)/api/home-sections/route"
    );
    const request = new Request("https://example.com/api/home-sections", {
      headers: { "CF-Connecting-IP": "203.0.113.71" },
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
    getHomeSectionListingPlanMock.mockClear();
    getResolvedHomeSectionsMock.mockClear();
    const blocked = await GET(request);

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("60");
    await expect(blocked.json()).resolves.toEqual({
      error: "Too many requests.",
      retryAfterSeconds: 60,
    });
    expect(getHomeSectionListingPlanMock).not.toHaveBeenCalled();
    expect(fetchHouseListingsMock).not.toHaveBeenCalled();
    expect(getResolvedHomeSectionsMock).not.toHaveBeenCalled();
  });

  it("uses the listing plan without exposing its fixed layout", async () => {
    const configs = [];
    getHomeSectionListingPlanMock.mockResolvedValue({
      configs,
      houseIds: [],
      layout: {
        degraded: true,
        items: [{ kind: "fixed", key: "faq", enabled: false }],
        source: "fallback",
      },
      listingLimit: 0,
    });
    fetchHouseListingsMock.mockResolvedValue([]);
    getResolvedHomeSectionsMock.mockResolvedValue({
      degraded: false,
      sections: [],
      source: "config",
    });
    const { GET } = await import(
      "../../../app/(public)/api/home-sections/route"
    );

    const response = await GET(
      new Request("https://example.com/api/home-sections", {
        headers: { "CF-Connecting-IP": "203.0.113.72" },
      }),
    );

    expect(getResolvedHomeSectionsMock).toHaveBeenCalledWith(
      [],
      configs,
      true,
    );
    await expect(response.json()).resolves.toEqual({
      sections: [],
      source: "config",
    });
  });

  it("keeps the degraded recommendation fallback when the plan read fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    getHomeSectionListingPlanMock.mockRejectedValue(new Error("unavailable"));
    fetchHouseListingsMock.mockResolvedValue([]);
    getResolvedHomeSectionsMock.mockResolvedValue({
      degraded: true,
      fallbackReason: "config_unavailable",
      sections: [],
      source: "fallback",
    });
    const { GET } = await import(
      "../../../app/(public)/api/home-sections/route"
    );

    const response = await GET(
      new Request("https://example.com/api/home-sections", {
        headers: { "CF-Connecting-IP": "203.0.113.73" },
      }),
    );

    expect(response.status).toBe(200);
    expect(getResolvedHomeSectionsMock).toHaveBeenCalledWith([]);
    consoleError.mockRestore();
  });
});
