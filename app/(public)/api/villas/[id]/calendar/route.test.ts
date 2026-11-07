import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";

const { fetchVillaBookingCalendar, hasActiveVillaListing, limitPublicApiRequest } =
  vi.hoisted(() => ({
    fetchVillaBookingCalendar: vi.fn(),
    hasActiveVillaListing: vi.fn(),
    limitPublicApiRequest: vi.fn(),
  }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/villas/booking-calendar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/villas/booking-calendar")>()),
  fetchVillaBookingCalendar,
}));
vi.mock("@/lib/villas/server", () => ({ hasActiveVillaListing }));
vi.mock("@/lib/api/rate-limit", () => ({ limitPublicApiRequest }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-31T18:30:00.000Z"));
  hasActiveVillaListing.mockResolvedValue(true);
  limitPublicApiRequest.mockReturnValue(null);
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

function read(query: string, id = "9") {
  return GET(
    new Request(`https://example.com/api/villas/${id}/calendar?${query}`),
    { params: Promise.resolve({ id }) },
  );
}

it("serves a single fresh month for a public villa", async () => {
  const calendar = { days: {}, month: "2026-09", status: "available" };
  fetchVillaBookingCalendar.mockResolvedValue({ calendar, status: "available" });

  const response = await read("month=2026-09");

  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.json()).toEqual(calendar);
  expect(fetchVillaBookingCalendar).toHaveBeenCalledExactlyOnceWith("9", "2026-09");
});

it.each([
  ["month=2026-06", "9"],
  ["month=2027-09", "9"],
  ["month=2026-13", "9"],
  ["month=2026-08&month=2026-09", "9"],
  ["month=2026-08&months=14", "9"],
  ["month=2026-08", "unknown"],
])("rejects unsupported month or villa inputs (%s, %s)", async (query, id) => {
  const response = await read(query, id);
  expect(response.status).toBe(400);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(fetchVillaBookingCalendar).not.toHaveBeenCalled();
});

it("does not fetch the upstream calendar for an unknown public villa", async () => {
  hasActiveVillaListing.mockResolvedValue(false);
  expect((await read("month=2026-08")).status).toBe(404);
  expect(fetchVillaBookingCalendar).not.toHaveBeenCalled();
});

it("returns an uncached error if the listing lookup fails", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  hasActiveVillaListing.mockRejectedValue(new Error("private Supabase details"));

  try {
    const response = await read("month=2026-08");
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.text()).not.toContain("private Supabase details");
    expect(fetchVillaBookingCalendar).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"reason":"listing_lookup_error"'));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("private Supabase details"));
  } finally {
    warn.mockRestore();
  }
});

it("returns an uncached error when the upstream month is unavailable", async () => {
  fetchVillaBookingCalendar.mockResolvedValue({ calendar: null, status: "unavailable" });
  const response = await read("month=2026-08");
  expect(response.status).toBe(502);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});

it("returns uncached rate-limit errors without contacting the upstream", async () => {
  limitPublicApiRequest.mockReturnValue(new Response(null, { status: 429 }));
  const response = await read("month=2026-08");
  expect(response.status).toBe(429);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(fetchVillaBookingCalendar).not.toHaveBeenCalled();
});
