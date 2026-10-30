import type { RawBookingCalendarResponse } from "./booking-calendar";

type JsonObject = Record<string, unknown>;
type InvalidField = "root" | "base_price" | "bookings" | "holidays" | "hot_holidays" | "protime_promotions";

export const BOOKING_CALENDAR_WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalText(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

function isNullablePrice(value: unknown): boolean {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function isOptionalPrice(value: unknown): boolean {
  return value === undefined || isNullablePrice(value);
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isDateRange(start: unknown, end: unknown, allowSameDay = true): boolean {
  return isDateKey(start) && isDateKey(end) && (allowSameDay ? start <= end : start < end);
}

function isBasePrice(value: unknown): boolean {
  return isObject(value) &&
    BOOKING_CALENDAR_WEEKDAYS.every((day) => isNullablePrice(value[`price_${day}`])) &&
    BOOKING_CALENDAR_WEEKDAYS.some((day) => typeof value[`price_${day}`] === "number") &&
    BOOKING_CALENDAR_WEEKDAYS.every((day) => isOptionalText(value[`people_${day}`]));
}

function isBooking(value: unknown): boolean {
  return isObject(value) &&
    isDateRange(value.book_checkin, value.book_checkout, false) &&
    isOptionalText(value.book_type);
}

function isHoliday(value: unknown): boolean {
  return isObject(value) &&
    isDateRange(value.holiday_start, value.holiday_end) &&
    isOptionalPrice(value.holiday_price) &&
    isOptionalText(value.holiday_alert) &&
    isOptionalText(value.holiday_people) &&
    isOptionalText(value.holiday_type);
}

function isHotHoliday(value: unknown): boolean {
  return isObject(value) &&
    isDateRange(value.hot_holiday_start, value.hot_holiday_end) &&
    isOptionalPrice(value.hot_holiday_price) &&
    isOptionalText(value.hot_holiday_people);
}

function isPromotion(value: unknown): boolean {
  return isObject(value) &&
    isDateRange(value.protime_start, value.protime_end) &&
    isOptionalText(value.protime_msg) &&
    BOOKING_CALENDAR_WEEKDAYS.every((day) => isOptionalPrice(value[`protime_price_${day}`])) &&
    BOOKING_CALENDAR_WEEKDAYS.every((day) => isOptionalText(value[`protime_people_${day}`]));
}

/** Reject incomplete availability instead of silently turning bad records into free days. */
export function validateBookingCalendarResponse(value: unknown):
  | { data: RawBookingCalendarResponse; invalidField: null }
  | { data: null; invalidField: InvalidField } {
  let invalidField: InvalidField | null = null;
  if (!isObject(value)) invalidField = "root";
  else if (!isBasePrice(value.base_price)) invalidField = "base_price";
  else if (!Array.isArray(value.bookings) || !value.bookings.every(isBooking)) invalidField = "bookings";
  else if (!Array.isArray(value.holidays) || !value.holidays.every(isHoliday)) invalidField = "holidays";
  else if (!Array.isArray(value.hot_holidays) || !value.hot_holidays.every(isHotHoliday)) invalidField = "hot_holidays";
  else if (!Array.isArray(value.protime_promotions) || !value.protime_promotions.every(isPromotion)) invalidField = "protime_promotions";

  return invalidField === null
    ? { data: value as RawBookingCalendarResponse, invalidField: null }
    : { data: null, invalidField };
}
