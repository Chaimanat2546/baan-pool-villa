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
  it("gets a token before a single-month calendar request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          expiresAt: Date.now() + 5 * 60_000,
          token: "calendar-token",
        }),
      )
      .mockResolvedValueOnce(Response.json({
        days: {},
        month: "2026-06",
        status: "available",
      }));
    vi.stubGlobal("fetch", fetchMock);

    await loadBookingCalendarMonth({
      cacheKey: "9:2026-06",
      listingId: "9",
      monthKey: "2026-06",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/villas/9/booking-calendar-token",
      expect.objectContaining({
        headers: { "X-BPV-Calendar": "1" },
        method: "POST",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/villas/9/booking-calendar?month=2026-06",
      expect.objectContaining({
        headers: {
          "X-BPV-Calendar": "1",
          "X-BPV-Calendar-Token": "calendar-token",
        },
      }),
    );
  });

  it("sends the token with six-month batch requests", async () => {
    const calendars = Array.from({ length: 6 }, (_, offset) => ({
      days: {},
      month: `2026-${String(offset + 6).padStart(2, "0")}`,
      status: "available",
    }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          expiresAt: Date.now() + 5 * 60_000,
          token: "batch-token",
        }),
      )
      .mockResolvedValueOnce(Response.json(calendars));
    vi.stubGlobal("fetch", fetchMock);

    await loadBookingCalendarMonths({
      listingId: "9",
      startMonthKey: "2026-06",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/villas/9/booking-calendar?month=2026-06&months=6",
      expect.objectContaining({
        headers: {
          "X-BPV-Calendar": "1",
          "X-BPV-Calendar-Token": "batch-token",
        },
      }),
    );
  });

  it("dedupes concurrent token requests for the same villa", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/booking-calendar-token")) {
        return Response.json({
          expiresAt: Date.now() + 5 * 60_000,
          token: "shared-token",
        });
      }

      const month = new URL(url, "https://example.com").searchParams.get(
        "month",
      );

      return Response.json({ days: {}, month, status: "available" });
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([
      loadBookingCalendarMonth({
        cacheKey: "9:2026-06",
        listingId: "9",
        monthKey: "2026-06",
      }),
      loadBookingCalendarMonth({
        cacheKey: "9:2026-07",
        listingId: "9",
        monthKey: "2026-07",
      }),
    ]);

    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).endsWith("/booking-calendar-token"),
      ),
    ).toHaveLength(1);
  });

  it("refreshes an invalid token and retries the calendar only once", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          expiresAt: Date.now() + 5 * 60_000,
          token: "stale-token",
        }),
      )
      .mockResolvedValueOnce(Response.json({ error: "Forbidden." }, { status: 403 }))
      .mockResolvedValueOnce(
        Response.json({
          expiresAt: Date.now() + 5 * 60_000,
          token: "fresh-token",
        }),
      )
      .mockResolvedValueOnce(
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

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-BPV-Calendar-Token": "fresh-token",
        }),
      }),
    );
  });

  it("does not retry a rate-limited calendar request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          expiresAt: Date.now() + 5 * 60_000,
          token: "calendar-token",
        }),
      )
      .mockResolvedValueOnce(
        Response.json(
          { error: "Too many requests.", retryAfterSeconds: 60 },
          { status: 429 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      loadBookingCalendarMonth({
        cacheKey: "9:2026-06",
        listingId: "9",
        monthKey: "2026-06",
      }),
    ).rejects.toThrow("Unable to load booking calendar.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
