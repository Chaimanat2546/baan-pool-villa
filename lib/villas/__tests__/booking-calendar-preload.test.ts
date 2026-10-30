import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingCalendarMonth } from "../booking-calendar";
import {
  getBangkokBookingCalendarMonthKeys,
  preloadVillaBookingCalendars,
} from "../booking-calendar-preload";

const { fetchVillaBookingCalendar } = vi.hoisted(() => ({
  fetchVillaBookingCalendar: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../booking-calendar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../booking-calendar")>();

  return {
    ...actual,
    fetchVillaBookingCalendar,
  };
});

function createCalendar(month: string): BookingCalendarMonth {
  return {
    days: {},
    month,
    status: "available",
  };
}

describe("getBangkokBookingCalendarMonthKeys", () => {
  it("uses the current Bangkok month at a UTC month boundary", () => {
    expect(
      getBangkokBookingCalendarMonthKeys(
        new Date("2026-07-31T18:30:00.000Z"),
      ),
    ).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
      "2027-05",
      "2027-06",
      "2027-07",
      "2027-08",
    ]);
  });
});

describe("preloadVillaBookingCalendars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([2, 3, 4])("recovers the initial Bangkok month on attempt %i and stops immediately", async (successfulAttempt) => {
    const now = new Date("2026-07-31T18:30:00.000Z");
    const monthKeys = getBangkokBookingCalendarMonthKeys(now);
    const currentMonth = monthKeys[1];
    let currentAttempts = 0;
    fetchVillaBookingCalendar.mockImplementation(async (_id: string, month: string) => {
      if (month === currentMonth && ++currentAttempts < successfulAttempt) {
        return { calendar: null, status: "unavailable", timedOut: true };
      }
      return { calendar: createCalendar(month), status: "available" };
    });

    const result = await preloadVillaBookingCalendars("9", now);

    expect(fetchVillaBookingCalendar).toHaveBeenCalledTimes(13 + successfulAttempt);
    expect(currentAttempts).toBe(successfulAttempt);
    for (const month of monthKeys.filter((month) => month !== currentMonth)) {
      expect(fetchVillaBookingCalendar.mock.calls.filter((call) => call[1] === month)).toHaveLength(1);
    }
    const loadId = fetchVillaBookingCalendar.mock.calls[0][2];
    expect(fetchVillaBookingCalendar).toHaveBeenLastCalledWith("9", "2026-08", loadId, successfulAttempt);
    expect(result.unavailableMonths).toEqual([]);
    expect(Object.keys(result.calendars)).toEqual(monthKeys);
    expect(console.info).toHaveBeenCalledWith("Booking calendar preload completed", expect.objectContaining({
      loadId, retryCount: successfulAttempt - 1, fetchAttemptCount: 13 + successfulAttempt, currentMonthAvailable: true,
    }));
  });

  it.each(["timeout", "unavailable", "reject"])("respects the four-attempt cap and stops early for %s", async (retryOutcome) => {
    const now = new Date("2026-07-31T18:30:00.000Z");
    const monthKeys = getBangkokBookingCalendarMonthKeys(now);
    const currentMonth = monthKeys[1];
    let currentAttempts = 0;
    fetchVillaBookingCalendar.mockImplementation(async (_id: string, month: string) => {
      if (month !== currentMonth) return { calendar: createCalendar(month), status: "available" };
      currentAttempts++;
      if (currentAttempts === 1 || retryOutcome === "timeout") return { calendar: null, status: "unavailable", timedOut: true };
      if (retryOutcome === "reject") throw new Error("retry failed");
      return { calendar: null, status: "unavailable" };
    });

    const result = await preloadVillaBookingCalendars("9", now);

    const expectedAttempts = retryOutcome === "timeout" ? 4 : 2;
    expect(currentAttempts).toBe(expectedAttempts);
    expect(fetchVillaBookingCalendar).toHaveBeenCalledTimes(13 + expectedAttempts);
    expect(result.unavailableMonths).toEqual([currentMonth]);
    expect(Object.keys(result.calendars)).toEqual(monthKeys.filter((month) => month !== currentMonth));
    expect(console.info).toHaveBeenCalledWith("Booking calendar preload completed", expect.objectContaining({
      retryCount: expectedAttempts - 1, fetchAttemptCount: 13 + expectedAttempts, currentMonthAvailable: false,
    }));
  });

  it("does not retry other months even if they time out", async () => {
    const now = new Date("2026-07-31T18:30:00.000Z");
    const monthKeys = getBangkokBookingCalendarMonthKeys(now);
    const currentMonth = monthKeys[1];
    fetchVillaBookingCalendar.mockImplementation(async (_id: string, month: string) => month === currentMonth
      ? { calendar: createCalendar(month), status: "available" }
      : { calendar: null, status: "unavailable", timedOut: true });

    const result = await preloadVillaBookingCalendars("9", now);

    expect(fetchVillaBookingCalendar).toHaveBeenCalledTimes(14);
    expect(Object.keys(result.calendars)).toEqual([currentMonth]);
    expect(console.info).toHaveBeenCalledWith("Booking calendar preload completed", expect.objectContaining({
      retryCount: 0, fetchAttemptCount: 14, currentMonthAvailable: true,
    }));
  });

  it.each(["missing_token", "unavailable"])("does not retry the displayed month for %s without a timeout", async (status) => {
    const now = new Date("2026-07-31T18:30:00.000Z");
    fetchVillaBookingCalendar.mockResolvedValue({ calendar: null, status });

    await preloadVillaBookingCalendars("9", now);

    expect(fetchVillaBookingCalendar).toHaveBeenCalledTimes(14);
    expect(console.info).toHaveBeenCalledWith("Booking calendar preload completed", expect.objectContaining({
      retryCount: 0, fetchAttemptCount: 14,
    }));
  });

  it("keeps available months when one upstream month is unavailable", async () => {
    const now = new Date("2026-07-31T18:30:00.000Z");
    const monthKeys = getBangkokBookingCalendarMonthKeys(now);
    const unavailableMonth = "2027-02";

    fetchVillaBookingCalendar.mockImplementation(
      async (_propertyId: string, month: string) =>
        month === unavailableMonth
          ? { calendar: null, status: "unavailable" as const }
          : { calendar: createCalendar(month), status: "available" as const },
    );

    const result = await preloadVillaBookingCalendars("villa-9", now);

    expect(fetchVillaBookingCalendar).toHaveBeenCalledTimes(14);
    expect(fetchVillaBookingCalendar).toHaveBeenCalledWith("villa-9", unavailableMonth, expect.any(String));
    expect(new Set(fetchVillaBookingCalendar.mock.calls.map((call) => call[2])).size).toBe(1);
    expect(result.unavailableMonths).toEqual([unavailableMonth]);
    expect(Object.keys(result.calendars)).toEqual(
      monthKeys.filter((month) => month !== unavailableMonth),
    );
    expect(result.calendars["2026-08"]).toEqual(createCalendar("2026-08"));
  });

  it("keeps fulfilled months when one upstream promise rejects", async () => {
    const now = new Date("2026-07-31T18:30:00.000Z");
    const monthKeys = getBangkokBookingCalendarMonthKeys(now);
    const rejectedMonth = "2026-12";

    fetchVillaBookingCalendar.mockImplementation(
      async (_propertyId: string, month: string) => {
        if (month === rejectedMonth) {
          throw new Error("upstream connection failed");
        }

        return {
          calendar: createCalendar(month),
          status: "available" as const,
        };
      },
    );

    const result = await preloadVillaBookingCalendars("villa-9", now);

    expect(result.unavailableMonths).toEqual([rejectedMonth]);
    expect(Object.keys(result.calendars)).toEqual(
      monthKeys.filter((month) => month !== rejectedMonth),
    );
    expect(result.calendars[rejectedMonth]).toBeUndefined();
  });
});
