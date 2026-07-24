const BOOKING_CALENDAR_CLIENT_MARKER = {
  "X-BPV-Calendar": "1",
};
const BOOKING_CALENDAR_TOKEN_REFRESH_BUFFER_MS = 10_000;
const BOOKING_CALENDAR_TOKEN_TIMEOUT_MS = 8_000;

interface BookingCalendarClientToken {
  expiresAt: number;
  token: string;
}

const bookingCalendarTokens = new Map<string, BookingCalendarClientToken>();
const bookingCalendarTokenRequests = new Map<
  string,
  Promise<BookingCalendarClientToken>
>();

export function clearBookingCalendarClientTokenCacheForTests() {
  bookingCalendarTokens.clear();
  bookingCalendarTokenRequests.clear();
}

function getReusableToken(listingId: string) {
  const cached = bookingCalendarTokens.get(listingId);

  if (
    !cached ||
    cached.expiresAt <= Date.now() + BOOKING_CALENDAR_TOKEN_REFRESH_BUFFER_MS
  ) {
    bookingCalendarTokens.delete(listingId);
    return null;
  }

  return cached;
}

function isBookingCalendarClientToken(
  value: unknown,
): value is BookingCalendarClientToken {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<BookingCalendarClientToken>;

  return (
    typeof candidate.token === "string" &&
    candidate.token.length > 0 &&
    typeof candidate.expiresAt === "number" &&
    Number.isFinite(candidate.expiresAt) &&
    candidate.expiresAt >
      Date.now() + BOOKING_CALENDAR_TOKEN_REFRESH_BUFFER_MS
  );
}

async function requestBookingCalendarToken(listingId: string) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => {
    controller.abort();
  }, BOOKING_CALENDAR_TOKEN_TIMEOUT_MS);

  try {
    const response = await fetch(
      `/api/villas/${encodeURIComponent(listingId)}/booking-calendar-token`,
      {
        headers: BOOKING_CALENDAR_CLIENT_MARKER,
        method: "POST",
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error("Unable to authorize booking calendar.");
    }

    const token = (await response.json()) as unknown;

    if (!isBookingCalendarClientToken(token)) {
      throw new Error("Invalid booking calendar token.");
    }

    bookingCalendarTokens.set(listingId, token);

    return token;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function getBookingCalendarToken(
  listingId: string,
): Promise<BookingCalendarClientToken> {
  const cached = getReusableToken(listingId);

  if (cached) {
    return Promise.resolve(cached);
  }

  const existingRequest = bookingCalendarTokenRequests.get(listingId);

  if (existingRequest) {
    return existingRequest;
  }

  const request = requestBookingCalendarToken(listingId).finally(() => {
    bookingCalendarTokenRequests.delete(listingId);
  });

  bookingCalendarTokenRequests.set(listingId, request);

  return request;
}

function discardRejectedToken(
  listingId: string,
  rejectedToken: BookingCalendarClientToken,
) {
  if (bookingCalendarTokens.get(listingId)?.token === rejectedToken.token) {
    bookingCalendarTokens.delete(listingId);
  }
}

function fetchCalendar(
  url: string,
  token: BookingCalendarClientToken,
  signal: AbortSignal,
) {
  return fetch(url, {
    headers: {
      ...BOOKING_CALENDAR_CLIENT_MARKER,
      "X-BPV-Calendar-Token": token.token,
    },
    signal,
  });
}

export async function fetchBookingCalendarWithToken(
  url: string,
  listingId: string,
  signal: AbortSignal,
) {
  const token = await getBookingCalendarToken(listingId);
  const response = await fetchCalendar(url, token, signal);

  if (response.status !== 403) {
    return response;
  }

  discardRejectedToken(listingId, token);
  const refreshedToken = await getBookingCalendarToken(listingId);

  return fetchCalendar(url, refreshedToken, signal);
}
