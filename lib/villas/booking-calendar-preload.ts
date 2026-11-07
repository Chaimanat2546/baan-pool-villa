import "server-only";

import {
  fetchVillaBookingCalendar,
  isValidBookingCalendarMonth,
} from "./booking-calendar";

function getBangkokYearAndMonth(now: Date): { month: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(now);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const year = Number(parts.find((part) => part.type === "year")?.value);

  return { month, year };
}

function getBangkokBookingCalendarMonthKey(now: Date, offset = 0): string {
  const { month, year } = getBangkokYearAndMonth(now);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isBrowsableBookingCalendarMonth(month: string, now = new Date()): boolean {
  return (
    isValidBookingCalendarMonth(month) &&
    month >= getBangkokBookingCalendarMonthKey(now, -1) &&
    month <= getBangkokBookingCalendarMonthKey(now, 12)
  );
}

export async function preloadVillaBookingCalendar(
  propertyId: string,
  now = new Date(),
) {
  const monthKey = getBangkokBookingCalendarMonthKey(now);
  const { calendar } = await fetchVillaBookingCalendar(propertyId, monthKey);
  return { calendar, monthKey };
}
