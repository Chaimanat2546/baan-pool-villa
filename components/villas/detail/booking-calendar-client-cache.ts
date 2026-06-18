import type { BookingCalendarMonth } from "./booking-calendar-ui";

const BOOKING_CALENDAR_CLIENT_CACHE_LIMIT = 60;
const BOOKING_CALENDAR_CLIENT_TIMEOUT_MS = 8_000;
const bookingCalendarClientCache = new Map<string, BookingCalendarMonth>();
const bookingCalendarClientRequests = new Map<
  string,
  Promise<BookingCalendarMonth>
>();

export function clearBookingCalendarClientCacheForTests() {
  bookingCalendarClientCache.clear();
  bookingCalendarClientRequests.clear();
}

export function peekBookingCalendarClientCache(
  cacheKey: string,
): BookingCalendarMonth | null {
  return bookingCalendarClientCache.get(cacheKey) ?? null;
}

function getCachedBookingCalendarMonth(
  cacheKey: string,
): BookingCalendarMonth | null {
  const cachedCalendar = bookingCalendarClientCache.get(cacheKey);

  if (!cachedCalendar) {
    return null;
  }

  bookingCalendarClientCache.delete(cacheKey);
  bookingCalendarClientCache.set(cacheKey, cachedCalendar);

  return cachedCalendar;
}

function setCachedBookingCalendarMonth(
  cacheKey: string,
  calendar: BookingCalendarMonth,
) {
  bookingCalendarClientCache.delete(cacheKey);
  bookingCalendarClientCache.set(cacheKey, calendar);

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
  const request = fetch(
    `/api/villas/${encodeURIComponent(listingId)}/booking-calendar?month=${monthKey}`,
    { signal: controller.signal },
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
