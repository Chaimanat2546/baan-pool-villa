import type { Dispatch, SetStateAction } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarNextMonthPointer } from "./booking-calendar-parts";
import { addCalendarMonths, THAI_MONTHS } from "./booking-calendar-ui";

interface BookingCalendarMonthCaptionProps {
  calendarMonth: { date: Date };
  className?: string;
  currentMonth: Date;
  setVisibleMonth: Dispatch<SetStateAction<Date>>;
}

export function BookingCalendarMonthCaption({
  calendarMonth,
  className,
  currentMonth,
  setVisibleMonth,
}: BookingCalendarMonthCaptionProps) {
  return (
    <div
      className={cn(className, "h-auto flex-col gap-4 px-0 pb-1")}
      data-calendar-nav="true"
    >
      <Button
        className="rounded-2xl px-10 text-lg font-extrabold text-[var(--site-primary)]"
        onClick={() => {
          setVisibleMonth(currentMonth);
        }}
        size="default"
        type="button"
        variant="outline"
      >
        วันนี้
      </Button>
      <div className="flex w-full items-center justify-between gap-4">
        <Button
          aria-label="ดูเดือนก่อนหน้า"
          className="size-10 rounded-2xl text-[var(--site-primary)]"
          onClick={() => {
            setVisibleMonth((month) => addCalendarMonths(month, -1));
          }}
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
          className="relative size-10 overflow-visible rounded-2xl text-[var(--site-primary)]"
          onClick={() => {
            setVisibleMonth((month) => addCalendarMonths(month, 1));
          }}
          size="icon"
          type="button"
          variant="outline"
        >
          <CalendarNextMonthPointer />
          <ChevronRight data-icon="inline-start" />
        </Button>
      </div>
    </div>
  );
}
