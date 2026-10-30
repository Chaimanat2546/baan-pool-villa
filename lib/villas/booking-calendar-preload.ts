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
  const startedAt = Date.now();
  const loadId = crypto.randomUUID();
  const monthKeys = getBangkokBookingCalendarMonthKeys(now);
  const results = await Promise.allSettled(
    monthKeys.map((month) => fetchVillaBookingCalendar(propertyId, month, loadId)),
  );
  // Only this initially displayed Bangkok month can retry, up to four total attempts.
  const currentMonth = monthKeys[1];
  let retryCount = 0;
  for (const attempt of [2, 3, 4] as const) {
    const currentMonthResult = results[1];
    if (
      currentMonthResult.status !== "fulfilled" ||
      currentMonthResult.value.status !== "unavailable" ||
      currentMonthResult.value.timedOut !== true
    ) break;

    retryCount++;
    const [retryResult] = await Promise.allSettled([
      fetchVillaBookingCalendar(propertyId, currentMonth, loadId, attempt),
    ]);
    results[1] = retryResult;
  }
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

  console.info("Booking calendar preload completed", {
    event: "booking_calendar_preload",
    loadId,
    propertyId: /^[1-9]\d{0,19}$/.test(propertyId) ? propertyId : null,
    requestedMonthCount: monthKeys.length,
    retryCount,
    fetchAttemptCount: monthKeys.length + retryCount,
    availableMonthCount: Object.keys(calendars).length,
    unavailableMonths,
    currentMonth,
    currentMonthAvailable: Boolean(calendars[currentMonth]),
    durationMs: Date.now() - startedAt,
  });

  return { calendars, unavailableMonths };
}
