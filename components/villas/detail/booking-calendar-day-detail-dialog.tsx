import { Phone } from "lucide-react";
import { LineIcon, MessengerIcon } from "@/components/layout/contact-icons";
import {
  formatCalendarPrice,
  formatThaiCalendarDate,
  type BookingCalendarDay,
} from "./booking-calendar-ui";

export function CalendarDayDetailDialog({
  contactLinks,
  date,
  day,
  onClose,
  primaryPhoneContact,
}: {
  contactLinks: { line: string; messenger: string };
  date: Date;
  day: BookingCalendarDay;
  onClose: () => void;
  primaryPhoneContact?: { href: string; phone: string };
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center overflow-y-auto px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-4 bg-[var(--site-surface-soft)]/40 backdrop-blur-xs animate-in fade-in duration-200 motion-reduce:animate-none md:items-center md:p-4"
      role="presentation"
    >
      <div
        aria-labelledby="calendar-day-detail-title"
        aria-modal="true"
        className="w-full max-w-sm rounded-[1.5rem] border border-[var(--site-border)] bg-[linear-gradient(145deg,var(--site-surface),var(--site-surface-soft))] p-4 text-[var(--site-text)] shadow-[var(--site-card-shadow)] ring-1 ring-[var(--site-primary)]/10 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] fill-mode-both motion-reduce:animate-none"
        data-date-detail-dialog="true"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="animate-in fade-in slide-in-from-top-1 duration-200 fill-mode-both motion-reduce:animate-none">
            <p id="calendar-day-detail-title" className="text-base font-black">
              รายละเอียดวันที่
            </p>
            <p className="mt-1 text-sm text-[var(--site-muted)]">
              {formatThaiCalendarDate(date)}
            </p>
          </div>
          <button
            aria-label="ปิดรายละเอียดวัน"
            className="rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-1 text-sm font-black text-[var(--site-muted)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:scale-105 hover:border-[var(--site-primary)] hover:text-[var(--site-primary)] active:translate-y-0 active:scale-95 animate-in fade-in zoom-in-95 delay-100 fill-mode-both motion-reduce:animate-none"
            onClick={onClose}
            type="button"
          >
            ปิด
          </button>
        </div>

        <div
          className="mt-4 overflow-hidden rounded-[1.25rem] border border-[var(--site-border)] bg-[var(--site-primary-soft)] shadow-[0_18px_42px_rgba(6,63,53,0.12)] animate-in fade-in slide-in-from-bottom-2 duration-300 delay-150 fill-mode-both motion-reduce:animate-none"
          data-date-detail-panel="true"
        >
          <div className="bg-[var(--site-primary)] px-4 py-4 text-[var(--site-on-primary)]">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--site-accent-on-dark)]">
              {day.label}
            </p>
            <p className="mt-2 text-3xl font-black leading-none">
              ราคา {formatCalendarPrice(day.price)}
            </p>
            <p className="mt-2 text-xs font-bold text-[var(--site-on-primary)]/80">
              ราคาเฉพาะวันที่เลือก ทักแอดมินเพื่อยืนยันก่อนหลุดคิว
            </p>
          </div>
          <div className="grid gap-3 p-3">
            {day.promotionMessage ? (
              <p className="whitespace-pre-line rounded-xl bg-[var(--site-surface)] px-3 py-2 text-xs font-bold leading-5 text-[var(--site-text)]">
                {day.promotionMessage}
              </p>
            ) : null}
            <p className="rounded-xl bg-[var(--site-primary-soft)] px-3 py-2 text-xs font-bold leading-5 text-[var(--site-text)]">
              ส่งวันนี้ให้ทีมจองได้ทันที พร้อมเช็กราคาสุดท้ายและเงื่อนไขเข้าพัก
            </p>
            <div className="grid grid-cols-2 gap-2">
              <a
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--site-primary)] px-3 text-sm font-black text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)]"
                href={contactLinks.line}
                rel="noreferrer"
                target="_blank"
              >
                <LineIcon className="h-5 w-5" />
                จอง LINE
              </a>
              <a
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--site-primary)] bg-[var(--site-primary-soft)] px-3 text-sm font-black text-[var(--site-primary)] transition hover:bg-[var(--site-surface-tint)]"
                href={contactLinks.messenger}
                rel="noreferrer"
                target="_blank"
              >
                <MessengerIcon className="h-5 w-5" />
                แชทเลย
              </a>
            </div>
            {primaryPhoneContact ? (
              <a
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 text-sm font-black text-[var(--site-text)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-primary-soft)]"
                href={primaryPhoneContact.href}
              >
                <Phone className="h-4 w-4" />
                โทร {primaryPhoneContact.phone}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
