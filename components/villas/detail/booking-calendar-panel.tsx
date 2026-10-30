"use client";

import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { BookingCalendarDayCell } from "./booking-calendar-day-cell";
import { CalendarDayDetailDialog } from "./booking-calendar-day-detail-dialog";
import { BookingCalendarMonthCaption } from "./booking-calendar-month-caption";
import { CalendarLegend } from "./booking-calendar-parts";
import {
  addCalendarMonths,
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
  bookingCalendars: Record<string, BookingCalendarMonth>;
  contactLinks: { line: string; messenger: string };
  currentBookingMonthKey: string;
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
  bookingCalendars,
  contactLinks,
  currentBookingMonthKey,
  fallbackPrice,
  phoneContacts,
}: BookingCalendarPanelProps) {
  const today = new Date();
  const todayStart = startOfCalendarDate(today);
  const [currentYear, currentMonthNumber] = currentBookingMonthKey
    .split("-")
    .map(Number);
  const currentMonth = new Date(currentYear, currentMonthNumber - 1, 1);
  const [visibleMonth, setVisibleMonth] = useState(() => currentMonth);
  const [selectedCalendarDate, setSelectedCalendarDate] =
    useState<Date | null>(null);
  const [isCalendarTipDismissed, setIsCalendarTipDismissed] = useState(false);
  const visibleMonthKey = formatCalendarMonthKey(visibleMonth);
  const isPastVisibleMonth = visibleMonth < currentMonth;
  const bookingCalendar = bookingCalendars[visibleMonthKey] ?? null;
  const isCalendarAvailable = bookingCalendar?.month === visibleMonthKey;
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
  const isDateDisabled = (date: Date) =>
    !isCalendarDateSelectable({ date, todayStart }) ||
    isOutsideVisibleMonth(date) ||
    bookingCalendar?.month !== visibleMonthKey ||
    getCalendarDay(date).disabled;

  useLockedBodyScroll(Boolean(selectedCalendarDate));

  return (
    <>
      {!isCalendarAvailable ? (
        <div
          className="mb-3 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)] p-3 text-sm text-[var(--site-text)]"
          data-calendar-unavailable="true"
          role="status"
        >
          <p className="font-bold">โหลดข้อมูลปฏิทินเดือนนี้ไม่สำเร็จ</p>
          <p className="mt-1 text-xs leading-6 text-[var(--site-muted)]">
            ยังยืนยันวันว่างไม่ได้ กรุณาโหลดหน้าใหม่หรือติดต่อแอดมินเพื่อตรวจสอบ
          </p>
          <button
            className="mt-2 min-h-11 rounded-lg border border-[var(--site-primary)] px-3 text-sm font-bold text-[var(--site-primary-text)] hover:bg-[var(--site-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-primary)]"
            onClick={() => window.location.reload()}
            type="button"
          >
            โหลดหน้าใหม่
          </button>
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
        footer={isCalendarAvailable ? <CalendarLegend /> : undefined}
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
