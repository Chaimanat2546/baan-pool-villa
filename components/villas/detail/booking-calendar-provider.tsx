"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { BookingCalendarMonth } from "@/lib/villas/booking-calendar";
import { formatCalendarMonthKey } from "./booking-calendar-ui";

type CalendarState =
  | { monthKey: string; status: "available"; calendar: BookingCalendarMonth }
  | { monthKey: string; status: "loading" | "unavailable"; calendar: null };

interface BookingCalendarContext {
  currentMonthKey: string;
  state: CalendarState;
  setVisibleMonth: Dispatch<SetStateAction<Date>>;
  retryMonth: () => void;
}

const BookingCalendarContext = createContext<BookingCalendarContext | null>(null);

export function bookingCalendarMonthDate(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

export function BookingCalendarProvider({
  children,
  currentMonthKey,
  enabled = true,
  initialCalendar,
  villaId,
}: {
  children: ReactNode;
  currentMonthKey: string;
  enabled?: boolean;
  initialCalendar: BookingCalendarMonth | null;
  villaId: string;
}) {
  const [state, setState] = useState<CalendarState>(() =>
    initialCalendar?.month === currentMonthKey
      ? { monthKey: currentMonthKey, calendar: initialCalendar, status: "available" }
      : { monthKey: currentMonthKey, calendar: null, status: "loading" },
  );

  useEffect(() => {
    if (!enabled || state.status !== "loading") {
      return;
    }

    const controller = new AbortController();
    const { monthKey } = state;

    async function loadMonth() {
      let next: CalendarState;
      try {
        const response = await fetch(
          `/api/villas/${encodeURIComponent(villaId)}/calendar?month=${monthKey}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error("Calendar request failed");
        }
        const calendar = (await response.json()) as BookingCalendarMonth | null;
        if (calendar?.month !== monthKey || calendar.status !== "available" || !calendar.days) {
          throw new Error("Invalid calendar response");
        }
        next = { monthKey, calendar, status: "available" };
      } catch {
        next = { monthKey, calendar: null, status: "unavailable" };
      }

      if (!controller.signal.aborted) {
        setState((current) => current === state ? next : current);
      }
    }

    void loadMonth();
    return () => controller.abort();
  }, [enabled, state, villaId]);

  function setVisibleMonth(update: SetStateAction<Date>) {
    setState((current) => {
      const visibleMonth = bookingCalendarMonthDate(current.monthKey);
      const monthKey = formatCalendarMonthKey(
        typeof update === "function" ? update(visibleMonth) : update,
      );
      return monthKey === current.monthKey
        ? current
        : { monthKey, calendar: null, status: "loading" };
    });
  }

  function retryMonth() {
    setState((current) => current.status === "unavailable"
      ? { ...current, status: "loading" }
      : current);
  }

  return (
    <BookingCalendarContext.Provider value={{ currentMonthKey, state, setVisibleMonth, retryMonth }}>
      {children}
    </BookingCalendarContext.Provider>
  );
}

export function useBookingCalendar() {
  const context = useContext(BookingCalendarContext);
  if (!context) {
    throw new Error("BookingCalendarProvider is required");
  }
  return context;
}
