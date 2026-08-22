import "server-only";

import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";

const BOOKING_CALENDAR_URL =
  "https://www.pattayapartypoolvilla.com/api/bookings";
const BOOKING_CALENDAR_TIMEOUT_MS = 8_000;

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export type BookingCalendarIcon = "fire";
export type BookingCalendarKind =
  | "base"
  | "booking_confirmed"
  | "booking_waiting"
  | "holiday"
  | "hot_holiday"
  | "hotpro"
  | "promotion";
export type BookingCalendarTone =
  | "booked"
  | "default"
  | "holiday"
  | "hot_holiday"
  | "hotpro"
  | "promotion"
  | "waiting";

export interface BookingCalendarDay {
  disabled: boolean;
  displayPrice: string | null;
  guestCapacity: string | null;
  holidayAlert: string | null;
  icons: BookingCalendarIcon[];
  kind: BookingCalendarKind;
  label: string;
  price: number | null;
  promotionMessage: string | null;
  tone: BookingCalendarTone;
}

export interface BookingCalendarMonth {
  days: Record<string, BookingCalendarDay>;
  month: string;
  status: "available";
}

export interface RawBookingCalendarResponse {
  base_price?: RawWeekdayPrice | null;
  bookings?: RawBooking[] | null;
  holidays?: RawHoliday[] | null;
  hot_holidays?: RawHotHoliday[] | null;
  protime_promotions?: RawPromotion[] | null;
}

interface RawWeekdayPrice {
  people_fri?: string | null;
  people_mon?: string | null;
  people_sat?: string | null;
  people_sun?: string | null;
  people_thu?: string | null;
  people_tue?: string | null;
  people_wed?: string | null;
  price_fri?: number | null;
  price_mon?: number | null;
  price_sat?: number | null;
  price_sun?: number | null;
  price_thu?: number | null;
  price_tue?: number | null;
  price_wed?: number | null;
}

interface RawBooking {
  book_checkin?: string | null;
  book_checkout?: string | null;
  book_type?: string | null;
}

interface RawHoliday {
  holiday_alert?: string | null;
  holiday_end?: string | null;
  holiday_people?: string | null;
  holiday_price?: number | null;
  holiday_start?: string | null;
  holiday_type?: string | null;
}

interface RawHotHoliday {
  hot_holiday_end?: string | null;
  hot_holiday_people?: string | null;
  hot_holiday_price?: number | null;
  hot_holiday_start?: string | null;
}

interface RawPromotion {
  protime_end?: string | null;
  protime_msg?: string | null;
  protime_people_fri?: string | null;
  protime_people_mon?: string | null;
  protime_people_sat?: string | null;
  protime_people_sun?: string | null;
  protime_people_thu?: string | null;
  protime_people_tue?: string | null;
  protime_people_wed?: string | null;
  protime_price_fri?: number | null;
  protime_price_mon?: number | null;
  protime_price_sat?: number | null;
  protime_price_sun?: number | null;
  protime_price_thu?: number | null;
  protime_price_tue?: number | null;
  protime_price_wed?: number | null;
  protime_start?: string | null;
}

type EventPriority = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface CalendarEvent {
  day: BookingCalendarDay;
  priority: EventPriority;
}

export type FetchVillaBookingCalendarResult =
  | { calendar: BookingCalendarMonth; status: "available" }
  | { calendar: null; status: "missing_token" | "unavailable" };

function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

/**
 * Validates the public `YYYY-MM` month format accepted by the booking calendar
 * route.
 *
 * @param month - The raw month value from the public request.
 * @returns `true` when the value matches the supported booking-calendar month format.
 */
export function isValidBookingCalendarMonth(month: string): boolean {
  return isValidMonth(month);
}

function createDateKey(date: Date): string {
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function isAsciiDigits(value: string): boolean {
  if (!value) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code < 48 || code > 57) {
      return false;
    }
  }

  return true;
}

function parseDateKey(dateKey: string | null | undefined): Date | null {
  if (!dateKey) {
    return null;
  }

  const parts = dateKey.split("-");

  if (parts.length !== 3 || parts.some((part) => !isAsciiDigits(part))) {
    return null;
  }

  const [year, month, day] = parts.map(Number);

  if (month < 1 || month > 12) {
    return null;
  }

  const daysInMonth = new Date(year, month, 0).getDate();

  if (day < 1 || day > daysInMonth) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function getMonthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(year, monthNumber - 1, 1);
  const end = new Date(year, monthNumber, 0);

  return { end, start };
}

function eachDateInRange(
  startKey: string | null | undefined,
  endKey: string | null | undefined,
  month: string,
  includeEnd: boolean,
): string[] {
  const startDate = parseDateKey(startKey);
  const endDate = parseDateKey(endKey);

  if (!startDate || !endDate) {
    return [];
  }

  const { end: monthEnd, start: monthStart } = getMonthBounds(month);
  const effectiveStart = new Date(
    Math.max(startDate.getTime(), monthStart.getTime()),
  );
  const rawEnd = includeEnd
    ? endDate
    : new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - 1);
  const effectiveEnd = new Date(Math.min(rawEnd.getTime(), monthEnd.getTime()));
  const dates: string[] = [];

  for (
    const date = effectiveStart;
    date.getTime() <= effectiveEnd.getTime();
    date.setDate(date.getDate() + 1)
  ) {
    dates.push(createDateKey(date));
  }

  return dates;
}

function getWeekdayKey(dateKey: string): WeekdayKey {
  const date = parseDateKey(dateKey);

  if (!date) {
    return "sun";
  }

  return WEEKDAY_KEYS[date.getDay()];
}

function getWeekdayPrice(
  basePrice: RawWeekdayPrice | null | undefined,
  dateKey: string,
): number | null {
  const weekday = getWeekdayKey(dateKey);
  const value = basePrice?.[`price_${weekday}` as keyof RawWeekdayPrice];

  return typeof value === "number" ? value : null;
}

function getWeekdayGuestCapacity(
  basePrice: RawWeekdayPrice | null | undefined,
  dateKey: string,
): string | null {
  const weekday = getWeekdayKey(dateKey);
  const value = basePrice?.[`people_${weekday}` as keyof RawWeekdayPrice];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getPromotionWeekdayPrice(
  promotion: RawPromotion,
  dateKey: string,
): number | null {
  const weekday = getWeekdayKey(dateKey);
  const value = promotion[`protime_price_${weekday}` as keyof RawPromotion];

  return typeof value === "number" ? value : null;
}

function getPromotionWeekdayGuestCapacity(
  promotion: RawPromotion,
  dateKey: string,
): string | null {
  const weekday = getWeekdayKey(dateKey);
  const value = promotion[`protime_people_${weekday}` as keyof RawPromotion];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatCalendarDayDisplayPrice(price: number | null): string | null {
  return typeof price === "number"
    ? new Intl.NumberFormat("th-TH").format(price)
    : null;
}

function createBaseDay(
  response: RawBookingCalendarResponse,
  dateKey: string,
): BookingCalendarDay {
  const price = getWeekdayPrice(response.base_price, dateKey);

  return {
    disabled: false,
    displayPrice: formatCalendarDayDisplayPrice(price),
    guestCapacity: getWeekdayGuestCapacity(response.base_price, dateKey),
    holidayAlert: null,
    icons: [],
    kind: "base",
    label: "วันธรรมดา",
    price,
    promotionMessage: null,
    tone: "default",
  };
}

function setCalendarEvent(
  events: Map<string, CalendarEvent>,
  dateKey: string,
  event: CalendarEvent,
) {
  const existing = events.get(dateKey);

  // Higher-priority events win so booked days override promotions and holiday
  // pricing metadata when multiple upstream ranges overlap.
  if (!existing || event.priority > existing.priority) {
    events.set(dateKey, event);
  }
}

function normalizeBookingType(bookType: string | null | undefined) {
  return bookType?.trim().toLowerCase() ?? "";
}

/**
 * Flattens the booking API response into one day record per date so the client
 * calendar can render without re-implementing upstream overlap rules.
 *
 * @param response - The raw booking calendar response from the upstream API.
 * @param month - The requested month in `YYYY-MM` format.
 * @returns The normalized calendar month used by the public villa detail page.
 */
export function normalizeBookingCalendar(
  response: RawBookingCalendarResponse,
  month: string,
): BookingCalendarMonth {
  const { end, start } = getMonthBounds(month);
  const events = new Map<string, CalendarEvent>();

  for (const promotion of response.protime_promotions ?? []) {
    const promotionMessage = promotion.protime_msg?.trim() || null;

    for (const dateKey of eachDateInRange(
      promotion.protime_start,
      promotion.protime_end,
      month,
      true,
    )) {
      const price =
        getPromotionWeekdayPrice(promotion, dateKey) ??
        getWeekdayPrice(response.base_price, dateKey);

      setCalendarEvent(events, dateKey, {
        day: {
          disabled: false,
          displayPrice: formatCalendarDayDisplayPrice(price),
          guestCapacity:
            getPromotionWeekdayGuestCapacity(promotion, dateKey) ??
            getWeekdayGuestCapacity(response.base_price, dateKey),
          holidayAlert: null,
          icons: [],
          kind: "promotion",
          label: "โปรโมชั่น",
          price,
          promotionMessage,
          tone: "promotion",
        },
        priority: 1,
      });
    }
  }

  for (const holiday of response.holidays ?? []) {
    const isHotpro = holiday.holiday_type === "hotpro";
    const holidayAlert = holiday.holiday_alert?.trim() || null;
    for (const dateKey of eachDateInRange(
      holiday.holiday_start,
      holiday.holiday_end,
      month,
      true,
    )) {
      const price =
        holiday.holiday_price ?? getWeekdayPrice(response.base_price, dateKey);

      setCalendarEvent(events, dateKey, {
        day: {
          disabled: false,
          displayPrice: formatCalendarDayDisplayPrice(price),
          guestCapacity:
            holiday.holiday_people?.trim() ||
            getWeekdayGuestCapacity(response.base_price, dateKey),
          holidayAlert,
          icons: isHotpro ? ["fire"] : [],
          kind: isHotpro ? "hotpro" : "holiday",
          label: isHotpro ? "โปรไฟลุก" : "วันหยุดนักขัตฤกษ์",
          price,
          promotionMessage: null,
          tone: isHotpro ? "hotpro" : "holiday",
        },
        priority: isHotpro ? 2 : 3,
      });
    }
  }

  for (const holiday of response.hot_holidays ?? []) {
    for (const dateKey of eachDateInRange(
      holiday.hot_holiday_start,
      holiday.hot_holiday_end,
      month,
      true,
    )) {
      const price =
        holiday.hot_holiday_price ??
        getWeekdayPrice(response.base_price, dateKey);
      const guestCapacity =
        holiday.hot_holiday_people?.trim() ||
        getWeekdayGuestCapacity(response.base_price, dateKey);

      setCalendarEvent(events, dateKey, {
        day: {
          disabled: false,
          displayPrice: formatCalendarDayDisplayPrice(price),
          guestCapacity,
          holidayAlert: null,
          icons: ["fire"],
          kind: "hot_holiday",
          label: "โปรไฟลุกในวันหยุด",
          price,
          promotionMessage: null,
          tone: "hot_holiday",
        },
        priority: 4,
      });
    }
  }

  for (const booking of response.bookings ?? []) {
    const isWaiting = normalizeBookingType(booking.book_type) === "waiting";
    for (const dateKey of eachDateInRange(
      booking.book_checkin,
      booking.book_checkout,
      month,
      false,
    )) {
      const price = getWeekdayPrice(response.base_price, dateKey);

      setCalendarEvent(events, dateKey, {
        day: {
          disabled: true,
          displayPrice: null,
          guestCapacity: getWeekdayGuestCapacity(response.base_price, dateKey),
          holidayAlert: null,
          icons: [],
          kind: isWaiting ? "booking_waiting" : "booking_confirmed",
          label: isWaiting ? "ติดจองแต่ยังไม่โอน" : "ติดจองแล้ว",
          price,
          promotionMessage: null,
          tone: isWaiting ? "waiting" : "booked",
        },
        priority: isWaiting ? 5 : 6,
      });
    }
  }

  const days: Record<string, BookingCalendarDay> = {};

  for (
    const date = new Date(start);
    date.getTime() <= end.getTime();
    date.setDate(date.getDate() + 1)
  ) {
    const dateKey = createDateKey(date);
    days[dateKey] = events.get(dateKey)?.day ?? createBaseDay(response, dateKey);
  }

  return {
    days,
    month,
    status: "available",
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  return JSON.parse(text) as T;
}

/**
 * Fetches one month of booking data through the fifteen-minute booking cache while
 * keeping the booking token server-only.
 *
 * @param propertyId - The villa property id expected by the booking API.
 * @param month - The requested month in `YYYY-MM` format.
 * @returns The normalized calendar result, or an availability status when the
 * data cannot be returned.
 */
export async function fetchVillaBookingCalendar(
  propertyId: string,
  month: string,
): Promise<FetchVillaBookingCalendarResult> {
  const token = process.env.PATTAYA_BOOKINGS_API_TOKEN?.trim();

  if (!token) {
    return { calendar: null, status: "missing_token" };
  }

  const url = new URL(BOOKING_CALENDAR_URL);
  url.searchParams.set("property_id", propertyId);
  url.searchParams.set("month", month);
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, BOOKING_CALENDAR_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      next: {
        revalidate: CACHE_REVALIDATE_SECONDS.bookingCalendar,
        tags: [CACHE_TAGS.villaDetails, CACHE_TAGS.villaDetail(propertyId)],
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { calendar: null, status: "unavailable" };
    }

    return {
      calendar: normalizeBookingCalendar(
        await readJson<RawBookingCalendarResponse>(response),
        month,
      ),
      status: "available",
    };
  } catch {
    return { calendar: null, status: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}
