import type { ComponentProps } from "react";
import { CalendarDayButton } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  CalendarDayIcons,
  CalendarDayOverlay,
  CalendarFirstAvailablePointer,
  CalendarFirstAvailableTooltip,
} from "./booking-calendar-parts";
import {
  getCalendarToneClass,
  type BookingCalendarDay,
} from "./booking-calendar-ui";
import { UserRound } from "lucide-react";

interface BookingCalendarDayCellProps extends ComponentProps<
  typeof CalendarDayButton
> {
  calendarDay: BookingCalendarDay;
  isCalendarTipDismissed: boolean;
  isFirstAvailable: boolean;
  isOutsideVisibleMonth: boolean;
  isPast: boolean;
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
  isToday,
  onDismissTip,
  ...props
}: BookingCalendarDayCellProps) {
  const shouldShowCalendarData = !isOutsideVisibleMonth;
  const isBlockedBooking = shouldShowCalendarData && calendarDay.disabled;
  const isPastUnbooked = isPast && !calendarDay.disabled;
  const isDisabled = isBlockedBooking || isPast || props.disabled;
  const shouldShowDayDetails = shouldShowCalendarData && !isPastUnbooked;
  const firstAvailableTooltipAlign =
    day.date.getDay() <= 1
      ? "start"
      : day.date.getDay() >= 5
        ? "end"
        : "center";
  const showFireText = shouldShowDayDetails && calendarDay.icons.includes("fire");

  return (
    <>
      <CalendarDayButton
        {...props}
        aria-disabled={isDisabled ? true : props["aria-disabled"]}
        className={cn(
          className,
          isPastUnbooked
            ? "bg-[var(--site-surface-tint)] text-[var(--site-muted)] ring-0 hover:bg-[var(--site-surface-tint)] hover:text-[var(--site-muted)] disabled:opacity-100 "
            : null,
          shouldShowCalendarData && isToday
            ? "border border-[var(--site-primary)] text-[var(--site-primary-text)] ring-2 ring-[var(--site-primary)]/20 hover:bg-[var(--site-primary-soft)] hover:text-[var(--site-primary-text)] "
            : null,
          isOutsideVisibleMonth
            ? "bg-[var(--site-surface-soft)] text-[var(--site-muted)] opacity-45 ring-0 shadow-none hover:bg-[var(--site-surface-soft)] hover:text-[var(--site-muted)] disabled:opacity-45 "
            : null,
          shouldShowDayDetails ? getCalendarToneClass(calendarDay) : null,
          isBlockedBooking
            ? "pointer-events-none cursor-not-allowed disabled:!opacity-100 "
            : null,
          "relative !block !h-auto !min-h-14 !min-w-0 !aspect-auto text-center ring-1 ring-[var(--site-border)]",
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
        disabled={isDisabled}
        tabIndex={isDisabled ? -1 : props.tabIndex}
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
          {shouldShowDayDetails &&
          !calendarDay.disabled &&
          calendarDay.displayPrice ? (
            <span
              className={cn(
                "mt-1 block text-[10px] leading-none font-medium italic text-[var(--site-muted)]",
                showFireText
                  ? "text-white [paint-order:stroke_fill] [-webkit-text-stroke:2px_black] drop-shadow-[0_1px_2px_rgba(120,12,12,0.24)]"
                  : null,
              )}
              data-calendar-day-price="true"
            >
              {calendarDay.displayPrice}
            </span>
          ) : null}
          {shouldShowDayDetails &&
          !calendarDay.disabled &&
          calendarDay.guestCapacity ? (
            <span
              className="mt-0.5 block text-[8px] leading-none italic text-[var(--site-muted)]"
              data-calendar-day-capacity="true"
            >
              <UserRound className="mr-0.5 inline-block shrink-0 align-text-bottom size-[10px]" />
              {calendarDay.guestCapacity}
            </span>
          ) : null}
        </div>
        <CalendarDayIcons icons={shouldShowDayDetails ? calendarDay.icons : []} />
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
