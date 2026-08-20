import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetPublicRateLimitForTests } from "@/lib/api/rate-limit";

const getCriticalHomeRailBatchMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));

vi.mock("../../(home)/server-data", () => ({
  getCriticalHomeRailBatch: getCriticalHomeRailBatchMock,
}));

beforeEach(() => {
  getCriticalHomeRailBatchMock.mockReset();
  getCriticalHomeRailBatchMock.mockResolvedValue({
    hasMore: false,
    nextOffset: 8,
    villas: [{ id: "5", title: "Villa 5" }],
  });
  resetPublicRateLimitForTests();
});

describe("GET /api/home-rail", () => {
  it("returns one cached four-card continuation batch", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "https://example.com/api/home-rail?rail=featured-villas&offset=4&exclude=1&exclude=2&exclude=3&exclude=4",
        { headers: { "CF-Connecting-IP": "203.0.113.91" } },
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=43200, stale-while-revalidate=43200",
    );
    expect(getCriticalHomeRailBatchMock).toHaveBeenCalledWith(
      "featured-villas",
      4,
      ["1", "2", "3", "4"],
    );
    await expect(response.json()).resolves.toEqual({
      hasMore: false,
      nextOffset: 8,
      villas: [{ id: "5", title: "Villa 5" }],
    });
  });

  it.each([
    "/api/home-rail?rail=featured-villas&offset=5",
    "/api/home-rail?rail=featured-villas&offset=4&debug=1",
    "/api/home-rail?rail=FEATURED&offset=4",
    "/api/home-rail?rail=featured-villas&offset=4&exclude=0",
    "/api/home-rail?rail=featured-villas&offset=4&exclude=1&exclude=1",
    "/api/home-rail?rail=featured-villas&offset=4&exclude=1&exclude=2&exclude=3&exclude=4&exclude=5",
  ])("rejects an unbounded or malformed continuation query: %s", async (path) => {
    const { GET } = await import("./route");
    const response = await GET(new Request(`https://example.com${path}`));

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(getCriticalHomeRailBatchMock).not.toHaveBeenCalled();
  });
});
