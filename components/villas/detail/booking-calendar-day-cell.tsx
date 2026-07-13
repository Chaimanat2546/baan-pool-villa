import type { ComponentProps } from "react";
import { CalendarDayButton } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  CalendarDayIcons,
  CalendarDayOverlay,
  CalendarFirstAvailablePointer,
  CalendarFirstAvailableTooltip,
} from "./booking-calendar-parts";
import { getCalendarToneClass, type BookingCalendarDay } from "./booking-calendar-ui";

interface BookingCalendarDayCellProps
  extends ComponentProps<typeof CalendarDayButton> {
  calendarDay: BookingCalendarDay;
  isCalendarTipDismissed: boolean;
  isFirstAvailable: boolean;
  isOutsideVisibleMonth: boolean;
  isPast: boolean;
  isPastVisibleMonth: boolean;
  isToday: boolean;
  onDismissTip: () => void;
}

export function BookingCalendarDayCell({
  calendarDay,
  className,
  day,
  isCalendarTipDismissed,
  isFirstAvailable,
  isOutsideVisibleMonth,
  isPast,
  isPastVisibleMonth,
  isToday,
  onDismissTip,
  ...props
}: BookingCalendarDayCellProps) {
  const shouldShowCalendarData = !isPast || isPastVisibleMonth;
  const isBlockedBooking =
    !isPastVisibleMonth &&
    shouldShowCalendarData &&
    !isOutsideVisibleMonth &&
    calendarDay.disabled;
  const firstAvailableTooltipAlign =
    day.date.getDay() <= 1
      ? "start"
      : day.date.getDay() >= 5
        ? "end"
        : "center";
  const showFireText =
    shouldShowCalendarData &&
    !isOutsideVisibleMonth &&
    calendarDay.icons.includes("fire");

  return (
    <>
      <CalendarDayButton
        {...props}
        aria-disabled={isBlockedBooking ? true : props["aria-disabled"]}
        className={cn(
          className,
          isPast && !isPastVisibleMonth
            ? "bg-[var(--site-surface-tint)] text-[var(--site-muted)] opacity-60 ring-0 hover:bg-[var(--site-surface-tint)] hover:text-[var(--site-muted)] disabled:opacity-60 "
            : null,
          shouldShowCalendarData && isToday
            ? "border border-[var(--site-primary)] text-[var(--site-primary)] ring-2 ring-[var(--site-primary)]/20 hover:bg-[var(--site-primary-soft)] hover:text-[var(--site-primary)] "
            : null,
          isOutsideVisibleMonth
            ? "bg-[var(--site-surface-soft)] text-[var(--site-muted)] opacity-45 ring-0 shadow-none hover:bg-[var(--site-surface-soft)] hover:text-[var(--site-muted)] disabled:opacity-45 "
            : null,
          shouldShowCalendarData && !isOutsideVisibleMonth
            ? getCalendarToneClass(calendarDay)
            : null,
          isBlockedBooking ? "pointer-events-none cursor-not-allowed " : null,
          "relative !block !h-12 !min-w-0 overflow-visible text-center opacity-70 ring-1 ring-[var(--site-border)] hover:opacity-100 disabled:opacity-70",
          "transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        )}
        data-calendar-day-kind={
          isOutsideVisibleMonth ? undefined : calendarDay.kind
        }
        data-calendar-day-tone={
          isOutsideVisibleMonth ? undefined : calendarDay.tone
        }
        data-calendar-first-available={isFirstAvailable ? "true" : undefined}
        day={day}
        disabled={isBlockedBooking || props.disabled}
        tabIndex={isBlockedBooking ? -1 : props.tabIndex}
      >
        <CalendarDayOverlay day={calendarDay} />
        <div className="relative z-10 pt-[5px] leading-none">
          <span
            className={cn(
              "block text-[18px] leading-none font-black",
              showFireText
                ? " text-white [paint-order:stroke_fill] [-webkit-text-stroke:2px_black] drop-shadow-[0_1px_2px_rgba(120,12,12,0.24)]"
                : null,
            )}
            data-calendar-day-number="true"
          >
            {day.date.getDate()}
          </span>
          {shouldShowCalendarData &&
          !isOutsideVisibleMonth &&
          !calendarDay.disabled &&
          calendarDay.displayPrice ? (
            <span
              className={cn(
                "block mt-1 text-[10px] leading-none font-black",
                showFireText
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
            shouldShowCalendarData && !isOutsideVisibleMonth
              ? calendarDay.icons
              : []
          }
        />
        {isFirstAvailable ? <CalendarFirstAvailablePointer /> : null}
      </CalendarDayButton>
      {isFirstAvailable && !isCalendarTipDismissed ? (
        <CalendarFirstAvailableTooltip
          align={firstAvailableTooltipAlign}
          onDismiss={onDismissTip}
        />
      ) : null}
    </>
  );
}
