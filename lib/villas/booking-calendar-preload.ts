import "server-only";

import {
  fetchVillaBookingCalendar,
  type BookingCalendarMonth,
} from "./booking-calendar";

export interface VillaBookingCalendarPreload {
  calendars: Record<string, BookingCalendarMonth>;
  unavailableMonths: string[];
}

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

export function getBangkokBookingCalendarMonthKeys(now = new Date()): string[] {
  const { month, year } = getBangkokYearAndMonth(now);

  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 + index - 1, 1));

    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export async function preloadVillaBookingCalendars(
  propertyId: string,
  now = new Date(),
): Promise<VillaBookingCalendarPreload> {
  const monthKeys = getBangkokBookingCalendarMonthKeys(now);
  const results = await Promise.allSettled(
    monthKeys.map((month) => fetchVillaBookingCalendar(propertyId, month)),
  );
  const calendars: Record<string, BookingCalendarMonth> = {};
  const unavailableMonths: string[] = [];

  for (const [index, result] of results.entries()) {
    const month = monthKeys[index];

    if (result.status === "fulfilled" && result.value.status === "available") {
      calendars[month] = result.value.calendar;
      continue;
    }

    unavailableMonths.push(month);
  }

  return { calendars, unavailableMonths };
}
