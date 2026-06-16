"use client";

import {
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  Flame,
  Phone,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
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
    icons: [],
    kind: "base",
    label: "วันธรรมดา",
    price,
    tone: "default",
  };
}

function getCalendarToneClass(day: BookingCalendarDay): string | null {
  switch (day.tone) {
    case "booked":
      return "bg-red-200 text-red-900 ring-1 ring-red-500/30 hover:bg-red-200 hover:text-red-900";
    case "holiday":
    case "hot_holiday":
      return "bg-[var(--site-accent-soft)] text-[var(--site-accent)] ring-1 ring-[var(--site-accent)]/25 hover:bg-[var(--site-accent-soft)] hover:text-[var(--site-accent)]";
    case "waiting":
      return "bg-emerald-200 text-emerald-900 ring-1 ring-emerald-500/30 hover:bg-emerald-200 hover:text-emerald-900";
    default:
      return null;
  }
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
    <motion.span
      aria-hidden="true"
      animate={iconAnimation}
      className={cn(
        "absolute right-1 bottom-1 inline-flex size-3.5 items-center justify-center rounded-full text-[var(--site-primary)]",
        hasFire ? "text-amber-600" : null,
        isEmpty ? "opacity-0" : null,
      )}
      data-calendar-icon-slot={isEmpty ? "empty" : "filled"}
      transition={iconTransition}
    >
      {hasPromotion ? (
        <BadgePercent
          aria-hidden="true"
          className="h-3.5 w-3.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)] text-pink-400"
          data-calendar-icon="promotion"
        />
      ) : null}
      {hasFire ? (
        <Flame
          aria-hidden="true"
          className="h-3.5 w-3.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)] text-amber-600"
          data-calendar-icon="fire"
        />
      ) : null}
    </motion.span>
  );
}

function CalendarLegendItem({
  children,
  icon,
  swatchClassName,
}: {
  children: string;
  icon?: BookingCalendarDay["icons"][number];
  swatchClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--site-muted)]">
      <span
        className={cn(
          "inline-flex size-4 items-center justify-center rounded-full border border-[var(--site-border)] bg-[var(--site-surface-soft)] text-[var(--site-text)]",
          swatchClassName,
        )}
      >
        {icon === "promotion" ? (
          <BadgePercent aria-hidden="true" className="h-3 w-3 text-pink-400" />
        ) : null}
        {icon === "fire" ? (
          <Flame aria-hidden="true" className="h-3 w-3 text-amber-600" />
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
            isPastCalendarDate(date) ||
            isOutsideVisibleMonth(date) ||
            getCalendarDay(date).disabled
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
                <CalendarLegendItem swatchClassName="border-emerald-500/30 bg-emerald-100">
                  ติดจองแต่ยังไม่โอน
                </CalendarLegendItem>
                <CalendarLegendItem swatchClassName="border-red-500/30 bg-red-100">
                  ติดจองแล้ว
                </CalendarLegendItem>
                <CalendarLegendItem swatchClassName="border-[var(--site-accent)]/25 bg-yellow-100">
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

              return (
                <CalendarDayButton
                  className={cn(
                    className,
                    isPast
                      ? "bg-[var(--site-surface-tint)] text-[var(--site-muted)] opacity-60 ring-0 hover:bg-[var(--site-surface-tint)] hover:text-[var(--site-muted)] disabled:opacity-60"
                      : null,
                    !isPast && isToday
                      ? "border border-[var(--site-primary)] text-[var(--site-primary)] ring-2 ring-[var(--site-primary)]/20 hover:bg-[var(--site-primary-soft)] hover:text-[var(--site-primary)]"
                      : null,
                    isOutsideVisibleMonth
                      ? "bg-[var(--site-surface-soft)] text-[var(--site-muted)] opacity-45 ring-0 shadow-none hover:bg-[var(--site-surface-soft)] hover:text-[var(--site-muted)] disabled:opacity-45"
                      : null,
                    !isPast && !isOutsideVisibleMonth
                      ? getCalendarToneClass(calendarDay)
                      : null,
                    calendarDay.disabled
                      ? "disabled:pointer-events-none disabled:opacity-100"
                      : null,
                    "relative grid !min-w-0 place-items-center overflow-hidden gap-0",
                    "transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  )}
                  data-calendar-day-kind={
                    isOutsideVisibleMonth ? undefined : calendarDay.kind
                  }
                  data-calendar-day-tone={
                    isOutsideVisibleMonth ? undefined : calendarDay.tone
                  }
                  day={day}
                  {...props}
                >
                  <span className="relative z-10 leading-none">
                    {day.date.getDate()}
                  </span>
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
          className="w-full rounded-[1.35rem] border border-[var(--site-border)] bg-[linear-gradient(180deg,var(--site-surface),var(--site-surface-soft))] p-3 text-[var(--site-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),var(--site-card-shadow)] ring-1 ring-[var(--site-primary)]/10 [--cell-size:2.35rem] sm:[--cell-size:2.5rem] [&_.rdp-day]:min-w-0 [&_.rdp-dropdown_root]:border-[var(--site-border)] [&_.rdp-dropdown_root]:bg-[var(--site-surface)] [&_.rdp-week]:grid [&_.rdp-week]:grid-cols-7 [&_.rdp-week]:gap-1.5 [&_.rdp-weekday]:flex [&_.rdp-weekday]:items-center [&_.rdp-weekday]:justify-center [&_.rdp-weekday]:text-[var(--site-muted)] [&_.rdp-weekdays]:grid [&_.rdp-weekdays]:grid-cols-7 [&_.rdp-weekdays]:gap-1.5"
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
                className="mt-4 rounded-[1.1rem] border border-[var(--site-border)] bg-[var(--site-primary-soft)] p-3 text-sm leading-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
                data-date-detail-panel="true"
              >
                <p className="font-black text-[var(--site-text)]">
                  {selectedCalendarDay.label}
                </p>
                <p className="mt-2 text-[var(--site-muted)]">
                  ราคา {formatCalendarPrice(selectedCalendarDay.price)}
                </p>
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
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--site-muted)]">
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
                <span className="shrink-0 text-[11px] font-bold text-[var(--site-muted)]">
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
