"use client";

import {
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  Phone,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useState, type ComponentProps } from "react";
import { LineIcon, MessengerIcon } from "@/components/layout/contact-icons";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { buildContactLinks, withPhoneHref } from "@/lib/site-contact";
import type { SiteSettings } from "@/lib/site-settings/types";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { VillaListing } from "@/lib/villas/types";
import { formatVillaPrice } from "../listing/villa-price";
import { findFact } from "./helpers";

const THAI_MONTHS = [
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

interface BookingCalendarDay {
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

interface BookingCalendarMonth {
  days: Record<string, BookingCalendarDay>;
  month: string;
  status: "available";
}

function startOfCalendarDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addCalendarMonths(date: Date, monthOffset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + monthOffset, 1);
}

function formatCalendarMonthKey(date: Date): string {
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, "0"),
  ].join("-");
}

function formatCalendarDateKey(date: Date): string {
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatThaiCalendarDate(date: Date): string {
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${
    date.getFullYear() + 543
  }`;
}

function formatCalendarPrice(price: number | null): string {
  return typeof price === "number"
    ? `${price.toLocaleString("th-TH")} บาท`
    : "- บาท";
}

function getFallbackCalendarDay(price: number): BookingCalendarDay {
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

function getCalendarToneClass(day: BookingCalendarDay): string | null {
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

function FireSvgIcon({
  className,
  ...props
}: ComponentProps<"svg">) {
  const gradientId = useId();

  return (
    <svg
      aria-hidden="true"
      viewBox="-33 0 255 255"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1="94.141"
          y1="255"
          x2="94.141"
          y2="0.188"
        >
          <stop offset="0" stopColor="#ff4c0d" />
          <stop offset="1" stopColor="#fc9502" />
        </linearGradient>
      </defs>
      <path
        d="M187.899,164.809 C185.803,214.868 144.574,254.812 94.000,254.812 C42.085,254.812 -0.000,211.312 -0.000,160.812 C-0.000,154.062 -0.121,140.572 10.000,117.812 C16.057,104.191 19.856,95.634 22.000,87.812 C23.178,83.513 25.469,76.683 32.000,87.812 C35.851,94.374 36.000,103.812 36.000,103.812 C36.000,103.812 50.328,92.817 60.000,71.812 C74.179,41.019 62.866,22.612 59.000,9.812 C57.662,5.384 56.822,-2.574 66.000,0.812 C75.352,4.263 100.076,21.570 113.000,39.812 C131.445,65.847 138.000,90.812 138.000,90.812 C138.000,90.812 143.906,83.482 146.000,75.812 C148.365,67.151 148.400,58.573 155.999,67.813 C163.226,76.600 173.959,93.113 180.000,108.812 C190.969,137.321 187.899,164.809 187.899,164.809 Z"
        fill={`url(#${gradientId})`}
        fillRule="evenodd"
      />
      <path
        d="M94.000,254.812 C58.101,254.812 29.000,225.711 29.000,189.812 C29.000,168.151 37.729,155.000 55.896,137.166 C67.528,125.747 78.415,111.722 83.042,102.172 C83.953,100.292 86.026,90.495 94.019,101.966 C98.212,107.982 104.785,118.681 109.000,127.812 C116.266,143.555 118.000,158.812 118.000,158.812 C118.000,158.812 125.121,154.616 130.000,143.812 C131.573,140.330 134.753,127.148 143.643,140.328 C150.166,150.000 159.127,167.390 159.000,189.812 C159.000,225.711 129.898,254.812 94.000,254.812 Z"
        fill="#fc9502"
        fillRule="evenodd"
      />
      <path
        d="M95.000,183.812 C104.250,183.812 104.250,200.941 116.000,223.812 C123.824,239.041 112.121,254.812 95.000,254.812 C77.879,254.812 69.000,240.933 69.000,223.812 C69.000,206.692 85.750,183.812 95.000,183.812 Z"
        fill="#fce202"
        fillRule="evenodd"
      />
    </svg>
  );
}

function CalendarDayIcons({ icons }: { icons: BookingCalendarDay["icons"] }) {
  const reduceMotion = useReducedMotion();
  const hasPromotion = icons.includes("promotion");
  const hasFire = icons.includes("fire");
  const isEmpty = icons.length === 0;

  const iconAnimation = reduceMotion
    ? undefined
    : {
        opacity: hasFire ? [0.82, 1, 0.86] : [0.78, 1, 0.78],
        rotate: hasFire ? [-5, 4, -3] : [0, -4, 4, 0],
        scale: hasFire ? [1, 1.16, 1.04] : [1, 1.1, 1],
      };
  const iconTransition = reduceMotion
    ? undefined
    : {
        duration: hasFire ? 1.25 : 1.8,
        ease: "easeInOut" as const,
        repeat: Infinity,
      };

  return (
    <>
      {hasFire ? (
        <motion.span
          aria-hidden="true"
          animate={iconAnimation}
          className="absolute inset-0 z-[1] grid place-items-center text-[var(--site-primary)]"
          data-calendar-icon-slot="filled"
          transition={iconTransition}
        >
          <FireSvgIcon
            className="size-8 drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
            data-calendar-icon="fire"
          />
        </motion.span>
      ) : null}
      {hasPromotion ? (
        <motion.span
          aria-hidden="true"
          animate={iconAnimation}
          className="pointer-events-none absolute top-0.5 right-0.5 z-[20] grid place-items-center"
          data-calendar-icon-slot="filled"
          transition={iconTransition}
        >
          <BadgePercent
            className="size-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)] text-rose-500/90"
            data-calendar-icon="promotion"
          />
        </motion.span>
      ) : null}
      {isEmpty ? (
        <span
          aria-hidden="true"
          className="absolute right-1 bottom-1 opacity-0"
          data-calendar-icon-slot="empty"
        />
      ) : null}
    </>
  );
}

function CalendarDayOverlay({ day }: { day: BookingCalendarDay }) {
  if (day.tone !== "booked") {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden rounded-[inherit] opacity-95"
      data-calendar-overlay="booked-stripes"
      data-calendar-overlay-style="cross"
    >
      <span className="absolute left-1/2 top-1/2 h-[2px] w-[142%] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-white/45 shadow-[0_1px_2px_rgba(70,8,8,0.12)]" />
      <span className="absolute left-1/2 top-1/2 h-[2px] w-[142%] -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-white/45 shadow-[0_1px_2px_rgba(70,8,8,0.12)]" />
    </span>
  );
}

function CalendarLegendItem({
  children,
  icon,
  overlay,
  swatchClassName,
}: {
  children: string;
  icon?: BookingCalendarDay["icons"][number];
  overlay?: "booked-cross";
  swatchClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-2.5 py-1 text-[11px] text-[var(--site-muted)]">
      <span
        className={cn(
          "relative inline-flex size-4 items-center justify-center overflow-hidden rounded-full border border-[var(--site-border)] bg-[var(--site-surface-soft)] text-[var(--site-text)]",
          swatchClassName,
        )}
      >
        {overlay === "booked-cross" ? (
          <>
            <span className="absolute left-1/2 top-1/2 h-[1.5px] w-[145%] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-white/55" />
            <span className="absolute left-1/2 top-1/2 h-[1.5px] w-[145%] -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-white/55" />
          </>
        ) : null}
        {icon === "promotion" ? (
          <BadgePercent aria-hidden="true" className="relative z-10 h-3 w-3 text-rose-500" />
        ) : null}
        {icon === "fire" ? (
          <FireSvgIcon className="relative z-10 size-3" />
        ) : null}
      </span>
      {children}
    </span>
  );
}

export function BookingSidebar({
  content,
  id = "contact",
  listing,
  settings,
}: {
  content: VillaDetailContent;
  id?: string;
  listing: VillaListing;
  settings: SiteSettings;
}) {
  const today = new Date();
  const todayStart = startOfCalendarDate(today);
  const currentYear = today.getFullYear();
  const currentMonth = new Date(currentYear, today.getMonth(), 1);
  const [visibleMonth, setVisibleMonth] = useState(
    () => currentMonth,
  );
  const [selectedCalendarDate, setSelectedCalendarDate] =
    useState<Date | null>(null);
  const [bookingCalendar, setBookingCalendar] =
    useState<BookingCalendarMonth | null>(null);
  const isPastCalendarDate = (date: Date) =>
    startOfCalendarDate(date).getTime() < todayStart.getTime();
  const isOutsideVisibleMonth = (date: Date) =>
    date.getFullYear() !== visibleMonth.getFullYear() ||
    date.getMonth() !== visibleMonth.getMonth();
  const getCalendarDay = (date: Date): BookingCalendarDay => {
    if (
      isOutsideVisibleMonth(date) ||
      bookingCalendar?.month !== formatCalendarMonthKey(visibleMonth)
    ) {
      return getFallbackCalendarDay(listing.price);
    }

    return (
      bookingCalendar.days[formatCalendarDateKey(date)] ??
      getFallbackCalendarDay(listing.price)
    );
  };
  const selectedCalendarDay = selectedCalendarDate
    ? getCalendarDay(selectedCalendarDate)
    : null;
  const checkIn = findFact(content.facts, "เช็คอิน") ?? "14:00";
  const checkOut =
    findFact(content.facts, "เช็คเอ้า") ??
    findFact(content.facts, "เช็คเอาท์") ??
    "12:00";
  const contactLinks = buildContactLinks(settings.contact);
  const phoneContacts = settings.contact.phoneContacts.map(withPhoneHref);
  const primaryPhoneContact = phoneContacts[0];

  useEffect(() => {
    const monthKey = formatCalendarMonthKey(visibleMonth);
    const controller = new AbortController();
    let isActive = true;

    void fetch(
      `/api/villas/${encodeURIComponent(listing.id)}/booking-calendar?month=${monthKey}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load booking calendar.");
        }

        return (await response.json()) as BookingCalendarMonth;
      })
      .then((calendar) => {
        if (isActive && calendar.month === monthKey) {
          setBookingCalendar(calendar);
        }
      })
      .catch((error: unknown) => {
        if (
          isActive &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setBookingCalendar(null);
        }
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [listing.id, visibleMonth]);

  useEffect(() => {
    if (!selectedCalendarDate) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      const currentPaddingRight =
        Number.parseFloat(window.getComputedStyle(document.body).paddingRight) ||
        0;
      document.body.style.paddingRight = `${
        currentPaddingRight + scrollbarWidth
      }px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [selectedCalendarDate]);

  return (
    <aside id={id} className="lg:self-start">
      <div
        className="rounded-[1.75rem] border border-[var(--site-border)] bg-[linear-gradient(145deg,var(--site-surface),var(--site-surface-soft))] p-3 shadow-[var(--site-card-shadow)] ring-1 ring-[var(--site-primary)]/10"
        data-booking-card-shell="true"
      >
        <Calendar
          mode="single"
          month={visibleMonth}
          onMonthChange={setVisibleMonth}
          disabled={(date) =>
            isPastCalendarDate(date) || isOutsideVisibleMonth(date)
          }
          onSelect={(date) => {
            if (
              date &&
              !isPastCalendarDate(date) &&
              !isOutsideVisibleMonth(date) &&
              !getCalendarDay(date).disabled
            ) {
              setSelectedCalendarDate(date);
            }
          }}
          hideNavigation
          today={today}
          formatters={{
            formatCaption: (date) =>
              `${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`,
          }}
          footer={
            <div className="mt-3 space-y-3">
              <div
                className="flex flex-wrap justify-center gap-1.5"
                data-calendar-legend="true"
              >
                <CalendarLegendItem icon="promotion">
                  โปรโมชั่น
                </CalendarLegendItem>
                <CalendarLegendItem swatchClassName="border-emerald-700 bg-emerald-700">
                  ติดจองแต่ยังไม่โอน
                </CalendarLegendItem>
                <CalendarLegendItem
                  overlay="booked-cross"
                  swatchClassName="border-[#8f1717]/55 bg-[linear-gradient(180deg,#cf3f3f_0%,#a61f1f_100%)]"
                >
                  ติดจองแล้ว
                </CalendarLegendItem>
                <CalendarLegendItem swatchClassName="border-[var(--site-accent)]/25 bg-yellow-600">
                  วันหยุด
                </CalendarLegendItem>
                <CalendarLegendItem icon="fire">โปรไฟลุก</CalendarLegendItem>
              </div>
              <div
                className="flex items-center justify-center gap-2"
                data-calendar-nav="true"
              >
                <Button
                  aria-label="ดูเดือนก่อนหน้า"
                  onClick={() => {
                    setVisibleMonth((month) => addCalendarMonths(month, -1));
                  }}
                  className="size-11 rounded-xl"
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <ChevronLeft data-icon="inline-start" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setVisibleMonth(currentMonth);
                  }}
                  className="h-11 rounded-xl px-6"
                  size="default"
                >
                  วันนี้
                </Button>
                <Button
                  aria-label="ดูเดือนถัดไป"
                  onClick={() => {
                    setVisibleMonth((month) => addCalendarMonths(month, 1));
                  }}
                  className="size-11 rounded-xl"
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <ChevronRight data-icon="inline-start" />
                </Button>
              </div>
            </div>
          }
          components={{
            DayButton: ({ className, day, ...props }) => {
              const isPast = isPastCalendarDate(day.date);
              const isToday =
                day.date.getFullYear() === today.getFullYear() &&
                day.date.getMonth() === today.getMonth() &&
                day.date.getDate() === today.getDate();
              const isOutsideVisibleMonth =
                day.date.getFullYear() !== visibleMonth.getFullYear() ||
                day.date.getMonth() !== visibleMonth.getMonth();
              const calendarDay = getCalendarDay(day.date);
              const isBlockedBooking =
                !isPast && !isOutsideVisibleMonth && calendarDay.disabled;

              return (
                <CalendarDayButton
                  {...props}
                  className={cn(
                    className,
                    isPast
                      ? "bg-[var(--site-surface-tint)] text-[var(--site-muted)] opacity-60 ring-0 hover:bg-[var(--site-surface-tint)] hover:text-[var(--site-muted)] disabled:opacity-60 "
                      : null,
                    !isPast && isToday
                      ? "border border-[var(--site-primary)] text-[var(--site-primary)] ring-2 ring-[var(--site-primary)]/20 hover:bg-[var(--site-primary-soft)] hover:text-[var(--site-primary)] "
                      : null,
                    isOutsideVisibleMonth
                      ? "bg-[var(--site-surface-soft)] text-[var(--site-muted)] opacity-45 ring-0 shadow-none hover:bg-[var(--site-surface-soft)] hover:text-[var(--site-muted)] disabled:opacity-45 "
                      : null,
                    !isPast && !isOutsideVisibleMonth
                      ? getCalendarToneClass(calendarDay)
                      : null,
                    isBlockedBooking
                      ? "pointer-events-none cursor-not-allowed "
                      : null,
                    "relative !block !h-12 !min-w-0 overflow-visible text-center opacity-70 ring-1 ring-[var(--site-border)] hover:opacity-100 disabled:opacity-70",
                    "transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  )}
                  data-calendar-day-kind={
                    isOutsideVisibleMonth ? undefined : calendarDay.kind
                  }
                  data-calendar-day-tone={
                    isOutsideVisibleMonth ? undefined : calendarDay.tone
                  }
                  day={day}
                  disabled={isBlockedBooking || props.disabled}
                  aria-disabled={isBlockedBooking ? true : props["aria-disabled"]}
                  tabIndex={isBlockedBooking ? -1 : props.tabIndex}
                >
                  <CalendarDayOverlay day={calendarDay} />
                  <div className="relative z-10 pt-[5px] leading-none">
                    <span
                      className={cn(
                        "block text-[18px] leading-none font-black",
                        !isPast &&
                          !isOutsideVisibleMonth &&
                          calendarDay.icons.includes("fire")
                          ? " text-white [paint-order:stroke_fill] [-webkit-text-stroke:2px_black] drop-shadow-[0_1px_2px_rgba(120,12,12,0.24)]"
                          : null,
                      )}
                      data-calendar-day-number="true"
                    >
                      {day.date.getDate()}
                    </span>
                    {!isPast &&
                    !isOutsideVisibleMonth &&
                    !calendarDay.disabled &&
                    calendarDay.displayPrice ? (
                      <span
                        className={cn(
                          "block mt-1 text-[10px] leading-none font-black",
                          !isPast &&
                            !isOutsideVisibleMonth &&
                            calendarDay.icons.includes("fire")
                            ? "text-white [paint-order:stroke_fill] [-webkit-text-stroke:2px_black] drop-shadow-[0_1px_2px_rgba(120,12,12,0.24)]"
                            : null,
                        )}
                        data-calendar-day-price="true"
                      >
                        {calendarDay.displayPrice}
                      </span>
                    ) : null}
                  </div>
                  <CalendarDayIcons
                    icons={
                      !isPast && !isOutsideVisibleMonth ? calendarDay.icons : []
                    }
                  />
                </CalendarDayButton>
              );
            },
          }}
          labels={{
            labelNext: () => "ดูเดือนถัดไป",
            labelPrevious: () => "ดูเดือนก่อนหน้า",
            labelDayButton: (date) => {
              return formatThaiCalendarDate(date);
            },
          }}
          //ปรับสไตล์ของปฏิทินให้เข้ากับธีมของเว็บไซต์ โดยใช้คลาส Tailwind CSS และกำหนดรูปแบบการแสดงผลของวันต่างๆ ในปฏิทิน
          className="w-full rounded-[1.35rem] border border-[var(--site-border)] bg-[linear-gradient(180deg,var(--site-surface),var(--site-surface-soft))] p-3 text-[var(--site-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),var(--site-card-shadow)] ring-1 ring-[var(--site-primary)]/10 [--cell-size:2.35rem] sm:[--cell-size:2.5rem] [&_.rdp-caption_label]:font-black [&_.rdp-day]:min-w-0 [&_.rdp-day_button]:font-black [&_.rdp-dropdown_root]:border-[var(--site-border)] [&_.rdp-dropdown_root]:bg-[var(--site-surface)] [&_.rdp-week]:my-4 [&_.rdp-week]:grid [&_.rdp-week]:grid-cols-7 [&_.rdp-week]:gap-1.5 [&_.rdp-weekday]:flex [&_.rdp-weekday]:items-center [&_.rdp-weekday]:justify-center [&_.rdp-weekday]:text-[var(--site-muted)] [&_.rdp-weekdays]:grid [&_.rdp-weekdays]:grid-cols-7 [&_.rdp-weekdays]:gap-1.5"
          buttonVariant="outline"
        />

        {selectedCalendarDate && selectedCalendarDay ? (
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center overflow-y-auto px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-4 bg-[var(--site-surface-soft)]/40 backdrop-blur-xs md:items-center md:p-4"
            role="presentation"
          >
            <div
              aria-labelledby="calendar-day-detail-title"
              aria-modal="true"
              className="w-full max-w-sm rounded-[1.5rem] border border-[var(--site-border)] bg-[linear-gradient(145deg,var(--site-surface),var(--site-surface-soft))] p-4 text-[var(--site-text)] shadow-[var(--site-card-shadow)] ring-1 ring-[var(--site-primary)]/10"
              role="dialog"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p
                    id="calendar-day-detail-title"
                    className="text-base font-black"
                  >
                    รายละเอียดวันที่
                  </p>
                  <p className="mt-1 text-sm text-[var(--site-muted)]">
                    {formatThaiCalendarDate(selectedCalendarDate)}
                  </p>
                </div>
                <button
                  aria-label="ปิดรายละเอียดวัน"
                  className="rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-1 text-sm font-black text-[var(--site-muted)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-[var(--site-primary)] hover:text-[var(--site-primary)]"
                  type="button"
                  onClick={() => {
                    setSelectedCalendarDate(null);
                  }}
                >
                  ปิด
                </button>
              </div>

              <div
                className="mt-4 overflow-hidden rounded-[1.25rem] border border-[var(--site-border)] bg-[var(--site-primary-soft)] shadow-[0_18px_42px_rgba(6,63,53,0.12)]"
                data-date-detail-panel="true"
              >
                <div className="bg-[var(--site-primary)] px-4 py-4 text-[var(--site-on-primary)]">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--site-accent-on-dark)]">
                    {selectedCalendarDay.label}
                  </p>
                  <p className="mt-2 text-3xl font-black leading-none">
                    ราคา {formatCalendarPrice(selectedCalendarDay.price)}
                  </p>
                  <p className="mt-2 text-xs font-bold text-[var(--site-on-primary)]/80">
                    ราคาเฉพาะวันที่เลือก ทักแอดมินเพื่อยืนยันก่อนหลุดคิว
                  </p>
                </div>
                <div className="grid gap-3 p-3">
                  {selectedCalendarDay.promotionMessage ? (
                    <p className="whitespace-pre-line rounded-xl bg-[var(--site-surface)] px-3 py-2 text-xs font-bold leading-5 text-[var(--site-text)]">
                      {selectedCalendarDay.promotionMessage}
                    </p>
                  ) : null}
                  <p className="rounded-xl bg-[var(--site-primary-soft)] px-3 py-2 text-xs font-bold leading-5 text-[var(--site-text)]">
                    ส่งวันที่นี้ให้ทีมจองได้ทันที พร้อมเช็กราคาสุดท้ายและเงื่อนไขเข้าพัก
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={contactLinks.line}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--site-primary)] px-3 text-sm font-black text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)]"
                    >
                      <LineIcon className="h-5 w-5" />
                      จอง LINE
                    </a>
                    <a
                      href={contactLinks.messenger}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--site-primary)] bg-[var(--site-primary-soft)] px-3 text-sm font-black text-[var(--site-primary)] transition hover:bg-[var(--site-surface-tint)]"
                    >
                      <MessengerIcon className="h-5 w-5" />
                      แชทเลย
                    </a>
                  </div>
                  {primaryPhoneContact ? (
                    <a
                      href={primaryPhoneContact.href}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 text-sm font-black text-[var(--site-text)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-primary-soft)]"
                    >
                      <Phone className="h-4 w-4" />
                      โทร {primaryPhoneContact.phone}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-[var(--site-primary)] bg-[var(--site-primary-soft)] p-3 text-sm text-[var(--site-muted)]">
          <p className="flex items-center justify-between gap-3 text-xs font-black text-[var(--site-primary)]">
            สถานะ
          </p>
          <p className="mt-2 text-xs leading-6">
            ติดต่อแอดมินเพื่อยืนยันช่วงวันที่ว่าง
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--site-primary)] bg-[var(--site-primary-soft)] p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--site-muted)]">
            เช็คอิน / เช็คเอาท์
          </p>
          <p className="mt-1 text-lg font-black text-[var(--site-text)]">
            {checkIn} - {checkOut}
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--site-border)] p-3 text-sm">
          <p className="font-black text-[var(--site-text)]">
            {formatVillaPrice(listing.price)} / คืน
          </p>
          <p className="mt-1 text-xs text-[var(--site-muted)]">
            เช็คอิน {checkIn} · เช็คเอาท์ {checkOut}
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="grid gap-2">
            {phoneContacts.map((contact) => (
              <a
                key={contact.phone}
                href={contact.href}
                className="inline-flex items-center justify-between gap-3 rounded-xl border border-[var(--site-border)] px-4 py-3 text-sm font-black text-[var(--site-text)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-primary-soft)]"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {contact.name} : {contact.phone}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-[var(--site-muted)]">
                  {contact.time.replace("ช่วง ", "")}
                </span>
              </a>
            ))}
          </div>

          <a
            href={contactLinks.messenger}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--site-primary)] bg-[var(--site-primary-soft)] px-4 py-3 text-sm font-black text-[var(--site-primary)] transition hover:bg-[var(--site-surface-tint)]"
          >
            <MessengerIcon className="h-6 w-6" />
            แชทเลย
          </a>

          <a
            href={contactLinks.line}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--site-primary)] px-4 py-3 text-sm font-black text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)]"
          >
            <LineIcon className="h-6 w-6" />
            จองผ่าน LINE
          </a>
        </div>
      </div>
    </aside>
  );
}
