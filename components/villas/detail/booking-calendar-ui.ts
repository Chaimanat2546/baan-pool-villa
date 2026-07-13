export const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

export interface BookingCalendarDay {
  disabled: boolean;
  displayPrice: string | null;
  icons: "fire"[];
  kind:
    | "base"
    | "booking_confirmed"
    | "booking_waiting"
    | "holiday"
    | "hot_holiday"
    | "hotpro"
    | "promotion";
  label: string;
  price: number | null;
  promotionMessage: string | null;
  tone:
    | "booked"
    | "default"
    | "holiday"
    | "hot_holiday"
    | "hotpro"
    | "promotion"
    | "waiting";
}

export interface BookingCalendarMonth {
  days: Record<string, BookingCalendarDay>;
  month: string;
  status: "available";
}

export function startOfCalendarDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isCalendarDateSelectable({
  date,
  todayStart,
  visibleMonth,
}: {
  date: Date;
  todayStart: Date;
  visibleMonth: Date;
}) {
  return (
    visibleMonth < new Date(todayStart.getFullYear(), todayStart.getMonth(), 1) ||
    startOfCalendarDate(date) >= todayStart
  );
}

export function addCalendarMonths(date: Date, monthOffset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + monthOffset, 1);
}

export function formatCalendarMonthKey(date: Date): string {
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, "0"),
  ].join("-");
}

export function formatCalendarDateKey(date: Date): string {
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatThaiCalendarDate(date: Date): string {
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${
    date.getFullYear() + 543
  }`;
}

export function formatCalendarPrice(price: number | null): string {
  return typeof price === "number"
    ? `${price.toLocaleString("th-TH")} บาท`
    : "- บาท";
}

export function getFallbackCalendarDay(price: number | null): BookingCalendarDay {
  return {
    disabled: false,
    displayPrice: price === null ? null : new Intl.NumberFormat("th-TH").format(price),
    icons: [],
    kind: "base",
    label: "วันธรรมดา",
    price,
    promotionMessage: null,
    tone: "default",
  };
}

export function findFirstAvailableCalendarDateKey({
  bookingCalendar,
  todayStart,
  fallbackPrice,
  visibleMonth,
  visibleMonthKey,
}: {
  bookingCalendar: BookingCalendarMonth | null;
  fallbackPrice: number | null;
  todayStart: Date;
  visibleMonth: Date;
  visibleMonthKey: string;
}): string | null {
  if (bookingCalendar?.month !== visibleMonthKey) {
    return null;
  }

  const firstDay =
    todayStart.getFullYear() === visibleMonth.getFullYear() &&
    todayStart.getMonth() === visibleMonth.getMonth()
      ? todayStart.getDate()
      : 1;
  const lastDay = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
  ).getDate();
  const lastDate = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    lastDay,
  );

  if (lastDate.getTime() < todayStart.getTime()) {
    return null;
  }

  for (let day = firstDay; day <= lastDay; day += 1) {
    const date = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      day,
    );
    const dateKey = formatCalendarDateKey(date);
    const calendarDay =
      bookingCalendar.days[dateKey] ?? getFallbackCalendarDay(fallbackPrice);

    if (!calendarDay.disabled) {
      return dateKey;
    }
  }

  return null;
}

export function getCalendarToneClass(day: BookingCalendarDay): string | null {
  switch (day.tone) {
    case "booked":
      return "bg-[var(--site-danger,#991b1b)] text-white ring-2 hover:text-white";
    case "holiday":
    case "hot_holiday":
      return "bg-yellow-500 text-white ring-1 ring-yellow-500/25 hover:bg-yellow-500 hover:text-white";
    case "waiting":
      return "bg-emerald-700 text-white ring-1 ring-emerald-700/30 hover:bg-emerald-700 hover:text-white";
    default:
      return null;
  }
}
