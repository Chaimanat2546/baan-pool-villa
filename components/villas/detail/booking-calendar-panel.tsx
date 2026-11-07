"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { BookingCalendarDayCell } from "./booking-calendar-day-cell";
import { CalendarDayDetailDialog } from "./booking-calendar-day-detail-dialog";
import { BookingCalendarMonthCaption } from "./booking-calendar-month-caption";
import { CalendarLegend } from "./booking-calendar-parts";
import { bookingCalendarMonthDate, useBookingCalendar } from "./booking-calendar-provider";
import {
  addCalendarMonths,
  findFirstAvailableCalendarDateKey,
  formatCalendarDateKey,
  formatThaiCalendarDate,
  getFallbackCalendarDay,
  isCalendarDateSelectable,
  startOfCalendarDate,
  type BookingCalendarDay,
} from "./booking-calendar-ui";
import { useLockedBodyScroll } from "./use-locked-body-scroll";

interface BookingCalendarPanelProps {
  contactLinks: { line: string; messenger: string };
  fallbackPrice: number | null;
  phoneContacts: { href: string; name: string; phone: string; time: string }[];
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
  phoneContacts,
}: BookingCalendarPanelProps) {
  const today = new Date();
  const todayStart = startOfCalendarDate(today);
  const { currentMonthKey, state, setVisibleMonth, retryMonth } = useBookingCalendar();
  const { calendar: bookingCalendar, monthKey: visibleMonthKey, status } = state;
  const currentMonth = bookingCalendarMonthDate(currentMonthKey);
  const visibleMonth = bookingCalendarMonthDate(visibleMonthKey);
  const [selectedCalendarDate, setSelectedCalendarDate] =
    useState<Date | null>(null);
  const [isCalendarTipDismissed, setIsCalendarTipDismissed] = useState(false);
  const isPastVisibleMonth = visibleMonth < currentMonth;
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
  const isDateDisabled = (date: Date) =>
    !isCalendarDateSelectable({ date, todayStart }) ||
    isOutsideVisibleMonth(date) ||
    bookingCalendar?.month !== visibleMonthKey ||
    getCalendarDay(date).disabled;
  const selectedCalendarDay = selectedCalendarDate && !isDateDisabled(selectedCalendarDate)
    ? getCalendarDay(selectedCalendarDate)
    : null;

  useLockedBodyScroll(Boolean(selectedCalendarDay));

  return (
    <>
      {status === "loading" ? (
        <p className="mb-2 px-2 py-1 text-sm text-[var(--site-muted)]" role="status">
          กำลังโหลดราคาและสถานะจอง…
        </p>
      ) : null}
      {status === "unavailable" ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-2 py-1">
          <p className="text-sm text-[var(--site-muted)]" role="alert">
            โหลดข้อมูลปฏิทินไม่ได้
          </p>
          <Button data-calendar-retry size="sm" type="button" variant="outline" onClick={retryMonth}>
            ลองใหม่
          </Button>
        </div>
      ) : null}
      <Calendar
        mode="single"
        month={visibleMonth}
        onMonthChange={setVisibleMonth}
        disabled={isDateDisabled}
        onSelect={(date) => {
          if (date && !isDateDisabled(date)) {
            setIsCalendarTipDismissed(true);
            setSelectedCalendarDate(date);
          }
        }}
        classNames={{
          disabled: "text-muted-foreground opacity-100",
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
              maximumMonth={addCalendarMonths(currentMonth, 12)}
              minimumMonth={addCalendarMonths(currentMonth, -1)}
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
          phoneContacts={phoneContacts}
        />
      ) : null}
    </>
  );
}
