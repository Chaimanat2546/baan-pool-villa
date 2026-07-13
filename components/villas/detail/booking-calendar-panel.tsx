"use client";

import { useEffect, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  loadBookingCalendarMonth,
  peekBookingCalendarClientCache,
} from "./booking-calendar-client-cache";
import { BookingCalendarDayCell } from "./booking-calendar-day-cell";
import { CalendarDayDetailDialog } from "./booking-calendar-day-detail-dialog";
import { BookingCalendarMonthCaption } from "./booking-calendar-month-caption";
import { CalendarLegend } from "./booking-calendar-parts";
import {
  findFirstAvailableCalendarDateKey,
  formatCalendarDateKey,
  formatCalendarMonthKey,
  formatThaiCalendarDate,
  getFallbackCalendarDay,
  isCalendarDateSelectable,
  startOfCalendarDate,
  type BookingCalendarDay,
  type BookingCalendarMonth,
} from "./booking-calendar-ui";
import { useLockedBodyScroll } from "./use-locked-body-scroll";

interface BookingCalendarPanelProps {
  contactLinks: { line: string; messenger: string };
  fallbackPrice: number | null;
  listingId: string;
  primaryPhoneContact?: { href: string; phone: string };
}

function isSameCalendarMonth(date: Date, month: Date) {
  return (
    date.getFullYear() === month.getFullYear() &&
    date.getMonth() === month.getMonth()
  );
}

function isSameCalendarDay(date: Date, day: Date) {
  return isSameCalendarMonth(date, day) && date.getDate() === day.getDate();
}

export function BookingCalendarPanel({
  contactLinks,
  fallbackPrice,
  listingId,
  primaryPhoneContact,
}: BookingCalendarPanelProps) {
  const today = new Date();
  const todayStart = startOfCalendarDate(today);
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [visibleMonth, setVisibleMonth] = useState(() => currentMonth);
  const [selectedCalendarDate, setSelectedCalendarDate] =
    useState<Date | null>(null);
  const [isCalendarTipDismissed, setIsCalendarTipDismissed] = useState(false);
  const [bookingCalendars, setBookingCalendars] = useState<
    Record<string, BookingCalendarMonth>
  >({});
  const visibleMonthKey = formatCalendarMonthKey(visibleMonth);
  const isPastVisibleMonth = visibleMonth < currentMonth;
  const bookingCalendarCacheKey = `${listingId}:${visibleMonthKey}`;
  const bookingCalendar =
    bookingCalendars[bookingCalendarCacheKey] ??
    peekBookingCalendarClientCache(bookingCalendarCacheKey) ??
    null;
  const firstAvailableCalendarDateKey = findFirstAvailableCalendarDateKey({
    bookingCalendar,
    fallbackPrice,
    todayStart,
    visibleMonth,
    visibleMonthKey,
  });
  const isOutsideVisibleMonth = (date: Date) =>
    !isSameCalendarMonth(date, visibleMonth);
  const getCalendarDay = (date: Date): BookingCalendarDay => {
    if (
      isOutsideVisibleMonth(date) ||
      bookingCalendar?.month !== visibleMonthKey
    ) {
      return { ...getFallbackCalendarDay(fallbackPrice), disabled: true };
    }

    return (
      bookingCalendar.days[formatCalendarDateKey(date)] ??
      getFallbackCalendarDay(fallbackPrice)
    );
  };
  const selectedCalendarDay = selectedCalendarDate
    ? getCalendarDay(selectedCalendarDate)
    : null;

  useEffect(() => {
    if (bookingCalendar?.month === visibleMonthKey) {
      return;
    }

    let isActive = true;

    void loadBookingCalendarMonth({
      cacheKey: bookingCalendarCacheKey,
      listingId,
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
  }, [bookingCalendar?.month, bookingCalendarCacheKey, listingId, visibleMonthKey]);

  useLockedBodyScroll(Boolean(selectedCalendarDate));

  return (
    <>
      <Calendar
        mode="single"
        month={visibleMonth}
        onMonthChange={setVisibleMonth}
        disabled={(date) =>
          !isCalendarDateSelectable({ date, todayStart, visibleMonth }) ||
          isOutsideVisibleMonth(date) ||
          bookingCalendar?.month !== visibleMonthKey
        }
        onSelect={(date) => {
          if (
            date &&
            isCalendarDateSelectable({ date, todayStart, visibleMonth }) &&
            !isOutsideVisibleMonth(date) &&
            (!getCalendarDay(date).disabled || isPastVisibleMonth)
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
            <BookingCalendarMonthCaption
              calendarMonth={calendarMonth}
              className={className}
              currentMonth={currentMonth}
              setVisibleMonth={setVisibleMonth}
              showNextMonthPointer={!isPastVisibleMonth}
            />
          ),
          DayButton: ({ className, day, ...props }) => {
            const isPast =
              startOfCalendarDate(day.date).getTime() < todayStart.getTime();
            const isToday = isSameCalendarDay(day.date, today);
            const isOutsideVisibleMonth = !isSameCalendarMonth(
              day.date,
              visibleMonth,
            );
            const calendarDay = getCalendarDay(day.date);
            const isFirstAvailable =
              !isPastVisibleMonth &&
              formatCalendarDateKey(day.date) === firstAvailableCalendarDateKey;

            return (
              <BookingCalendarDayCell
                {...props}
                calendarDay={calendarDay}
                className={className}
                day={day}
                isCalendarTipDismissed={isCalendarTipDismissed}
                isFirstAvailable={isFirstAvailable}
                isOutsideVisibleMonth={isOutsideVisibleMonth}
                isPast={isPast}
                isPastVisibleMonth={isPastVisibleMonth}
                isToday={isToday}
                onDismissTip={() => {
                  setIsCalendarTipDismissed(true);
                }}
              />
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
    </>
  );
}
