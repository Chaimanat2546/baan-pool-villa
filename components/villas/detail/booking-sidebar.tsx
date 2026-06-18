"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { buildContactLinks, withPhoneHref } from "@/lib/site-contact";
import type { SiteSettings } from "@/lib/site-settings/types";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { VillaListing } from "@/lib/villas/types";
import { formatVillaPrice } from "../listing/villa-price";
import {
  loadBookingCalendarMonth,
  peekBookingCalendarClientCache,
} from "./booking-calendar-client-cache";
import { CalendarDayDetailDialog } from "./booking-calendar-day-detail-dialog";
import {
  CalendarDayIcons,
  CalendarDayOverlay,
  CalendarFirstAvailablePointer,
  CalendarFirstAvailableTooltip,
  CalendarLegend,
} from "./booking-calendar-parts";
import {
  addCalendarMonths,
  formatCalendarDateKey,
  formatCalendarMonthKey,
  formatThaiCalendarDate,
  getCalendarToneClass,
  getFallbackCalendarDay,
  startOfCalendarDate,
  THAI_MONTHS,
  type BookingCalendarDay,
  type BookingCalendarMonth,
} from "./booking-calendar-ui";
import { BookingSidebarContactActions } from "./booking-sidebar-contact-actions";
import { findFact } from "./helpers";

export { clearBookingCalendarClientCacheForTests } from "./booking-calendar-client-cache";

function findFirstAvailableCalendarDateKey({
  bookingCalendar,
  todayStart,
  fallbackPrice,
  visibleMonth,
  visibleMonthKey,
}: {
  bookingCalendar: BookingCalendarMonth | null;
  fallbackPrice: number;
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
  const [isCalendarTipDismissed, setIsCalendarTipDismissed] = useState(false);
  const [bookingCalendars, setBookingCalendars] = useState<
    Record<string, BookingCalendarMonth>
  >({});
  const visibleMonthKey = formatCalendarMonthKey(visibleMonth);
  const bookingCalendarCacheKey = `${listing.id}:${visibleMonthKey}`;
  const bookingCalendar =
    bookingCalendars[bookingCalendarCacheKey] ??
    peekBookingCalendarClientCache(bookingCalendarCacheKey) ??
    null;
  const firstAvailableCalendarDateKey = findFirstAvailableCalendarDateKey({
    bookingCalendar,
    fallbackPrice: listing.price,
    todayStart,
    visibleMonth,
    visibleMonthKey,
  });
  const isPastCalendarDate = (date: Date) =>
    startOfCalendarDate(date).getTime() < todayStart.getTime();
  const isOutsideVisibleMonth = (date: Date) =>
    date.getFullYear() !== visibleMonth.getFullYear() ||
    date.getMonth() !== visibleMonth.getMonth();
  const getCalendarDay = (date: Date): BookingCalendarDay => {
    if (
      isOutsideVisibleMonth(date) ||
      bookingCalendar?.month !== visibleMonthKey
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
    if (bookingCalendar?.month === visibleMonthKey) {
      return;
    }

    let isActive = true;

    void loadBookingCalendarMonth({
      cacheKey: bookingCalendarCacheKey,
      listingId: listing.id,
      monthKey: visibleMonthKey,
    })
      .then((calendar) => {
        if (isActive && calendar.month === visibleMonthKey) {
          setBookingCalendars((currentCalendars) => ({
            ...currentCalendars,
            [bookingCalendarCacheKey]: calendar,
          }));
        }
      })
      .catch(() => {
        if (isActive) {
          setBookingCalendars((currentCalendars) => {
            const nextCalendars = { ...currentCalendars };

            delete nextCalendars[bookingCalendarCacheKey];

            return nextCalendars;
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [bookingCalendar?.month, bookingCalendarCacheKey, listing.id, visibleMonthKey]);

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
              setIsCalendarTipDismissed(true);
              setSelectedCalendarDate(date);
            }
          }}
          hideNavigation
          today={today}
          footer={<CalendarLegend />}
          components={{
            MonthCaption: ({ calendarMonth, className }) => (
              <div
                className={cn(className, "h-auto flex-col gap-4 px-0 pb-1")}
                data-calendar-nav="true"
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setVisibleMonth(currentMonth);
                  }}
                  className="rounded-2xl px-10 text-lg font-extrabold text-[var(--site-primary)]"
                  size="default"
                >
                  วันนี้
                </Button>
                <div className="flex justify-between w-full items-center gap-4">
                  <Button
                    aria-label="ดูเดือนก่อนหน้า"
                    onClick={() => {
                      setVisibleMonth((month) =>
                        addCalendarMonths(month, -1),
                      );
                    }}
                    className="size-10 rounded-2xl text-[var(--site-primary)]"
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <ChevronLeft data-icon="inline-start" />
                  </Button>
                  <div className="text-center text-xl font-extrabold text-[var(--site-text)]">
                    {THAI_MONTHS[calendarMonth.date.getMonth()]}{" "}
                    {calendarMonth.date.getFullYear() + 543}
                  </div>
                  <Button
                    aria-label="ดูเดือนถัดไป"
                    onClick={() => {
                      setVisibleMonth((month) => addCalendarMonths(month, 1));
                    }}
                    className="size-10 rounded-2xl text-[var(--site-primary)]"
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <ChevronRight data-icon="inline-start" />
                  </Button>
                </div>
              </div>
            ),
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
              const isFirstAvailable =
                formatCalendarDateKey(day.date) === firstAvailableCalendarDateKey;
              const firstAvailableTooltipAlign =
                day.date.getDay() <= 1
                  ? "start"
                  : day.date.getDay() >= 5
                    ? "end"
                    : "center";
              const isBlockedBooking =
                !isPast && !isOutsideVisibleMonth && calendarDay.disabled;

              return (
                <>
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
                    data-calendar-first-available={
                      isFirstAvailable ? "true" : undefined
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
                    {isFirstAvailable ? <CalendarFirstAvailablePointer /> : null}
                  </CalendarDayButton>
                  {isFirstAvailable && !isCalendarTipDismissed ? (
                    <CalendarFirstAvailableTooltip
                      align={firstAvailableTooltipAlign}
                      onDismiss={() => {
                        setIsCalendarTipDismissed(true);
                      }}
                    />
                  ) : null}
                </>
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
          <CalendarDayDetailDialog
            contactLinks={contactLinks}
            date={selectedCalendarDate}
            day={selectedCalendarDay}
            onClose={() => {
              setSelectedCalendarDate(null);
            }}
            primaryPhoneContact={primaryPhoneContact}
          />
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

        <BookingSidebarContactActions
          contactLinks={contactLinks}
          phoneContacts={phoneContacts}
        />
      </div>
    </aside>
  );
}
