"use client";

import { ChevronLeft, ChevronRight, Phone } from "lucide-react";
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

function startOfCalendarDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addCalendarMonths(date: Date, monthOffset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + monthOffset, 1);
}

function formatThaiCalendarDate(date: Date): string {
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${
    date.getFullYear() + 543
  }`;
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
  const isPastCalendarDate = (date: Date) =>
    startOfCalendarDate(date).getTime() < todayStart.getTime();
  const checkIn = findFact(content.facts, "เช็คอิน") ?? "14:00";
  const checkOut =
    findFact(content.facts, "เช็คเอ้า") ??
    findFact(content.facts, "เช็คเอาท์") ??
    "12:00";
  const contactLinks = buildContactLinks(settings.contact);
  const phoneContacts = settings.contact.phoneContacts.map(withPhoneHref);

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
          disabled={{ before: todayStart }}
          onSelect={(date) => {
            if (date && !isPastCalendarDate(date)) {
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
            <div
              className="mt-3 flex items-center justify-center gap-2"
              data-calendar-nav="true"
            >
              <Button
                aria-label="ดูเดือนก่อนหน้า"
                onClick={() => {
                  setVisibleMonth((month) => addCalendarMonths(month, -1));
                }}
                className="size-10 rounded-xl"
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
                className="h-10 rounded-xl px-5"
                size="default"
              >
                วันนี้
              </Button>
              <Button
                aria-label="ดูเดือนถัดไป"
                onClick={() => {
                  setVisibleMonth((month) => addCalendarMonths(month, 1));
                }}
                className="size-10 rounded-xl"
                size="icon"
                type="button"
                variant="outline"
              >
                <ChevronRight data-icon="inline-start" />
              </Button>
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
                    "transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  )}
                  day={day}
                  {...props}
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
          className="w-full rounded-[1.35rem] border border-[var(--site-border)] bg-[linear-gradient(180deg,var(--site-surface),var(--site-surface-soft))] p-3 text-[var(--site-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),var(--site-card-shadow)] ring-1 ring-[var(--site-primary)]/10 [--cell-size:2.35rem] sm:[--cell-size:2.5rem] [&_.rdp-dropdown_root]:border-[var(--site-border)] [&_.rdp-dropdown_root]:bg-[var(--site-surface)] [&_.rdp-weekday]:text-[var(--site-muted)]"
          buttonVariant="outline"
        />

        {selectedCalendarDate ? (
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center overflow-y-auto px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-[1px] md:items-center md:p-4"
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
                  วันนี้เป็นวันธรรมดา
                </p>
                <p className="mt-2 text-[var(--site-muted)]">ราคา - บาท</p>
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
