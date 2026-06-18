import { describe, expect, it } from "vitest";

import {
  addCalendarMonths,
  formatCalendarDateKey,
  formatCalendarMonthKey,
  formatCalendarPrice,
  formatThaiCalendarDate,
  getCalendarToneClass,
  getFallbackCalendarDay,
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
      "bg-[var(--site-accent)]",
    );
    expect(getCalendarToneClass({ ...fallbackDay, tone: "waiting" })).toContain(
      "bg-[var(--site-primary)]",
    );
  });
});
