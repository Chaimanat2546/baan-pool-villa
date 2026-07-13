import { describe, expect, it } from "vitest";

import {
  addCalendarMonths,
  findFirstAvailableCalendarDateKey,
  formatCalendarDateKey,
  formatCalendarMonthKey,
  formatCalendarPrice,
  formatThaiCalendarDate,
  getCalendarToneClass,
  getFallbackCalendarDay,
  isCalendarDateSelectable,
  startOfCalendarDate,
} from "../booking-calendar-ui";

describe("booking calendar UI helpers", () => {
  it("formats calendar dates and prices for the sidebar", () => {
    const date = new Date(2026, 5, 7, 18, 30);

    expect(startOfCalendarDate(date)).toEqual(new Date(2026, 5, 7));
    expect(addCalendarMonths(date, 2)).toEqual(new Date(2026, 7, 1));
    expect(formatCalendarMonthKey(date)).toBe("2026-06");
    expect(formatCalendarDateKey(date)).toBe("2026-06-07");
    expect(formatThaiCalendarDate(date)).toContain("2569");
    expect(formatCalendarPrice(12500)).toContain("12,500");
    expect(formatCalendarPrice(null)).toContain("-");
  });

  it("builds fallback days and tone classes without touching rendering", () => {
    const fallbackDay = getFallbackCalendarDay(9200);

    expect(fallbackDay).toMatchObject({
      disabled: false,
      displayPrice: "9,200",
      icons: [],
      kind: "base",
      price: 9200,
      promotionMessage: null,
      tone: "default",
    });
    expect(getCalendarToneClass(fallbackDay)).toBeNull();
    expect(getCalendarToneClass({ ...fallbackDay, tone: "booked" })).toContain(
      "bg-[var(--site-danger,#991b1b)]",
    );
    expect(getCalendarToneClass({ ...fallbackDay, tone: "holiday" })).toContain(
      "bg-yellow-500",
    );
    expect(getCalendarToneClass({ ...fallbackDay, tone: "waiting" })).toContain(
      "bg-emerald-700",
    );
  });

  it("finds the first selectable calendar day in the visible month", () => {
    const fallbackDay = getFallbackCalendarDay(9200);
    const bookedDay = {
      ...fallbackDay,
      disabled: true,
      kind: "booking_confirmed" as const,
      tone: "booked" as const,
    };
    const calendar = {
      days: {
        "2026-06-16": bookedDay,
        "2026-06-17": bookedDay,
      },
      month: "2026-06",
      status: "available" as const,
    };

    expect(
      findFirstAvailableCalendarDateKey({
        bookingCalendar: calendar,
        fallbackPrice: 9200,
        todayStart: new Date(2026, 5, 16),
        visibleMonth: new Date(2026, 5, 1),
        visibleMonthKey: "2026-06",
      }),
    ).toBe("2026-06-18");
    expect(
      findFirstAvailableCalendarDateKey({
        bookingCalendar: calendar,
        fallbackPrice: 9200,
        todayStart: new Date(2026, 5, 16),
        visibleMonth: new Date(2026, 6, 1),
        visibleMonthKey: "2026-07",
      }),
    ).toBeNull();
  });

  it("allows inspecting dates in a prior visible month", () => {
    const todayStart = new Date(2026, 6, 13);

    expect(
      isCalendarDateSelectable({
        date: new Date(2026, 5, 16),
        todayStart,
        visibleMonth: new Date(2026, 5, 1),
      }),
    ).toBe(true);
    expect(
      isCalendarDateSelectable({
        date: new Date(2026, 6, 12),
        todayStart,
        visibleMonth: new Date(2026, 6, 1),
      }),
    ).toBe(false);
  });
});
