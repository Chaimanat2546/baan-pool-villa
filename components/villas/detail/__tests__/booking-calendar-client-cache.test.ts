import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearBookingCalendarClientCacheForTests,
  loadBookingCalendarMonth,
  loadBookingCalendarMonths,
} from "../booking-calendar-client-cache";

afterEach(() => {
  clearBookingCalendarClientCacheForTests();
  vi.unstubAllGlobals();
});

describe("booking calendar client requests", () => {
  it("marks single-month requests as coming from the calendar client", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        days: {},
        month: "2026-06",
        status: "available",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await loadBookingCalendarMonth({
      cacheKey: "9:2026-06",
      listingId: "9",
      monthKey: "2026-06",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/villas/9/booking-calendar?month=2026-06",
      expect.objectContaining({
        headers: { "X-BPV-Calendar": "1" },
      }),
    );
  });

  it("marks six-month batch requests as coming from the calendar client", async () => {
    const calendars = Array.from({ length: 6 }, (_, offset) => ({
      days: {},
      month: `2026-${String(offset + 6).padStart(2, "0")}`,
      status: "available",
    }));
    const fetchMock = vi.fn().mockResolvedValue(Response.json(calendars));
    vi.stubGlobal("fetch", fetchMock);

    await loadBookingCalendarMonths({
      listingId: "9",
      startMonthKey: "2026-06",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/villas/9/booking-calendar?month=2026-06&months=6",
      expect.objectContaining({
        headers: { "X-BPV-Calendar": "1" },
      }),
    );
  });
});
