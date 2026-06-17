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
  icons: ("fire" | "promotion")[];
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

export function getFallbackCalendarDay(price: number): BookingCalendarDay {
  return {
    disabled: false,
    displayPrice: new Intl.NumberFormat("th-TH").format(price),
    icons: [],
    kind: "base",
    label: "วันธรรมดา",
    price,
    promotionMessage: null,
    tone: "default",
  };
}

export function getCalendarToneClass(day: BookingCalendarDay): string | null {
  switch (day.tone) {
    case "booked":
      return "bg-red-800 text-white ring-2 hover:text-white";
    case "holiday":
    case "hot_holiday":
      return "bg-yellow-500 text-white ring-1 ring-[var(--site-accent)]/25 hover:bg-yellow-500 hover:text-white";
    case "waiting":
      return "bg-emerald-700 text-white ring-1 ring-emerald-500/30 hover:bg-emerald-700 hover:text-emerald-100";
    default:
      return null;
  }
}
