import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PUBLIC_RATE_LIMIT_POLICIES,
  resetPublicRateLimitForTests,
} from "@/lib/api/rate-limit";
import { getResolvedHomeSections } from "@/lib/home-sections/server";
import { fetchHouseListings } from "@/lib/villas/server";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/villas/server", () => ({
  fetchHouseListings: vi.fn(),
}));

vi.mock("@/lib/home-sections/server", () => ({
  getResolvedHomeSections: vi.fn(),
}));

const fetchHouseListingsMock = vi.mocked(fetchHouseListings);
const getResolvedHomeSectionsMock = vi.mocked(getResolvedHomeSections);

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  resetPublicRateLimitForTests();
  fetchHouseListingsMock.mockReset();
  getResolvedHomeSectionsMock.mockReset();
});

describe("GET /api/home-sections", () => {
  it("rate limits repeated catalog requests before resolving sections", async () => {
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
    getResolvedHomeSectionsMock.mockClear();
    const blocked = await GET(request);

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("60");
    await expect(blocked.json()).resolves.toEqual({
      error: "Too many requests.",
      retryAfterSeconds: 60,
    });
    expect(fetchHouseListingsMock).not.toHaveBeenCalled();
    expect(getResolvedHomeSectionsMock).not.toHaveBeenCalled();
  });
});
