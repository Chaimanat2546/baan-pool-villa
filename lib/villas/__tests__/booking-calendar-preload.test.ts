import { expect, it, vi } from "vitest";
import {
  isBrowsableBookingCalendarMonth,
  preloadVillaBookingCalendar,
} from "../booking-calendar-preload";

const { fetchVillaBookingCalendar } = vi.hoisted(() => ({
  fetchVillaBookingCalendar: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../booking-calendar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../booking-calendar")>()),
  fetchVillaBookingCalendar,
}));

const now = new Date("2026-07-31T18:30:00.000Z");

it("loads just the current Bangkok month on the initial render", async () => {
  const calendar = { days: {}, month: "2026-08", status: "available" };
  fetchVillaBookingCalendar.mockResolvedValue({ calendar, status: "available" });

  await expect(preloadVillaBookingCalendar("9", now)).resolves.toEqual({
    calendar,
    monthKey: "2026-08",
  });
  expect(fetchVillaBookingCalendar).toHaveBeenCalledExactlyOnceWith("9", "2026-08");
});

it("keeps the requested month when the initial upstream read fails", async () => {
  fetchVillaBookingCalendar.mockResolvedValue({ calendar: null, status: "unavailable" });
  await expect(preloadVillaBookingCalendar("9", now)).resolves.toEqual({
    calendar: null,
    monthKey: "2026-08",
  });
});

it("allows the previous month through twelve months ahead across year boundaries", () => {
  expect(isBrowsableBookingCalendarMonth("2026-06", now)).toBe(false);
  expect(isBrowsableBookingCalendarMonth("2026-07", now)).toBe(true);
  expect(isBrowsableBookingCalendarMonth("2027-08", now)).toBe(true);
  expect(isBrowsableBookingCalendarMonth("2027-09", now)).toBe(false);
  expect(isBrowsableBookingCalendarMonth("2026-13", now)).toBe(false);
});
