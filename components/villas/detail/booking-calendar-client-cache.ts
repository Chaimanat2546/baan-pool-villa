import type { BookingCalendarMonth } from "./booking-calendar-ui";
import {
  clearBookingCalendarClientTokenCacheForTests,
  fetchBookingCalendarWithToken,
} from "./booking-calendar-client-token";

const BOOKING_CALENDAR_CLIENT_CACHE_LIMIT = 60;
const BOOKING_CALENDAR_CLIENT_CACHE_TTL_MS = 15 * 60 * 1_000;
const BOOKING_CALENDAR_CLIENT_TIMEOUT_MS = 8_000;
const bookingCalendarClientCache = new Map<
  string,
  { calendar: BookingCalendarMonth; expiresAt: number }
>();
const bookingCalendarClientRequests = new Map<
  string,
  Promise<BookingCalendarMonth>
>();
const bookingCalendarClientBatchRequests = new Map<
  string,
  Promise<BookingCalendarMonth[]>
>();

export function clearBookingCalendarClientCacheForTests() {
  bookingCalendarClientCache.clear();
  bookingCalendarClientRequests.clear();
  bookingCalendarClientBatchRequests.clear();
  clearBookingCalendarClientTokenCacheForTests();
}

export function peekBookingCalendarClientCache(
  cacheKey: string,
): BookingCalendarMonth | null {
  return getCachedBookingCalendarMonth(cacheKey);
}

function getCachedBookingCalendarMonth(
  cacheKey: string,
): BookingCalendarMonth | null {
  const cached = bookingCalendarClientCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    bookingCalendarClientCache.delete(cacheKey);

    return null;
  }

  bookingCalendarClientCache.delete(cacheKey);
  bookingCalendarClientCache.set(cacheKey, cached);

  return cached.calendar;
}

function setCachedBookingCalendarMonth(
  cacheKey: string,
  calendar: BookingCalendarMonth,
) {
  bookingCalendarClientCache.delete(cacheKey);
  bookingCalendarClientCache.set(cacheKey, {
    calendar,
    expiresAt: Date.now() + BOOKING_CALENDAR_CLIENT_CACHE_TTL_MS,
  });

  while (bookingCalendarClientCache.size > BOOKING_CALENDAR_CLIENT_CACHE_LIMIT) {
    const oldestCacheKey = bookingCalendarClientCache.keys().next().value;

    if (!oldestCacheKey) {
      return;
    }

    bookingCalendarClientCache.delete(oldestCacheKey);
  }
}

function setBookingCalendarClientRequest(
  cacheKey: string,
  request: Promise<BookingCalendarMonth>,
) {
  bookingCalendarClientRequests.delete(cacheKey);
  bookingCalendarClientRequests.set(cacheKey, request);

  while (bookingCalendarClientRequests.size > BOOKING_CALENDAR_CLIENT_CACHE_LIMIT) {
    const oldestCacheKey = bookingCalendarClientRequests.keys().next().value;

    if (!oldestCacheKey) {
      return;
    }

    bookingCalendarClientRequests.delete(oldestCacheKey);
  }
}

export function loadBookingCalendarMonth({
  cacheKey,
  listingId,
  monthKey,
}: {
  cacheKey: string;
  listingId: string;
  monthKey: string;
}): Promise<BookingCalendarMonth> {
  const cachedCalendar = getCachedBookingCalendarMonth(cacheKey);

  if (cachedCalendar) {
    return Promise.resolve(cachedCalendar);
  }

  const existingRequest = bookingCalendarClientRequests.get(cacheKey);

  if (existingRequest) {
    return existingRequest;
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => {
    controller.abort();
  }, BOOKING_CALENDAR_CLIENT_TIMEOUT_MS);
  const request = fetchBookingCalendarWithToken(
    `/api/villas/${encodeURIComponent(listingId)}/booking-calendar?month=${monthKey}`,
    listingId,
    controller.signal,
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Unable to load booking calendar.");
      }

      return (await response.json()) as BookingCalendarMonth;
    })
    .then((calendar) => {
      setCachedBookingCalendarMonth(cacheKey, calendar);

      return calendar;
    })
    .finally(() => {
      globalThis.clearTimeout(timeout);
      bookingCalendarClientRequests.delete(cacheKey);
    });

  setBookingCalendarClientRequest(cacheKey, request);

  return request;
}

export function loadBookingCalendarMonths({
  listingId,
  startMonthKey,
}: {
  listingId: string;
  startMonthKey: string;
}): Promise<BookingCalendarMonth[]> {
  const [year, month] = startMonthKey.split("-").map(Number);
  const monthKeys = Array.from({ length: 6 }, (_, offset) => {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));

    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
    ].join("-");
  });
  const cachedCalendars = monthKeys.map((monthKey) =>
    getCachedBookingCalendarMonth(`${listingId}:${monthKey}`),
  );

  if (cachedCalendars.every(Boolean)) {
    return Promise.resolve(cachedCalendars as BookingCalendarMonth[]);
  }

  const requestKey = `${listingId}:${startMonthKey}:6`;
  const existingRequest = bookingCalendarClientBatchRequests.get(requestKey);

  if (existingRequest) {
    return existingRequest;
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => {
    controller.abort();
  }, BOOKING_CALENDAR_CLIENT_TIMEOUT_MS);
  const request = fetchBookingCalendarWithToken(
    `/api/villas/${encodeURIComponent(listingId)}/booking-calendar?month=${startMonthKey}&months=6`,
    listingId,
    controller.signal,
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Unable to load booking calendar.");
      }

      const calendars = (await response.json()) as BookingCalendarMonth[];

      if (!Array.isArray(calendars)) {
        throw new Error("Invalid booking calendar response.");
      }

      return calendars;
    })
    .then((calendars) => {
      calendars.forEach((calendar) => {
        setCachedBookingCalendarMonth(
          `${listingId}:${calendar.month}`,
          calendar,
        );
      });

      return calendars;
    })
    .finally(() => {
      globalThis.clearTimeout(timeout);
      bookingCalendarClientBatchRequests.delete(requestKey);
    });

  bookingCalendarClientBatchRequests.set(requestKey, request);

  return request;
}
