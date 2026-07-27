import { describe, expect, it, vi } from "vitest";
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
    expect(fetchVillaBookingCalendar).toHaveBeenCalledWith("villa-9", unavailableMonth);
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
