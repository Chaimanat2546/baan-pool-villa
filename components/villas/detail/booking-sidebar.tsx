import { CalendarDays, ChevronLeft, ChevronRight, Phone } from "lucide-react";
import { LineIcon, MessengerIcon } from "@/components/layout/contact-icons";
import { buildContactLinks, withPhoneHref } from "@/lib/site-contact";
import type { SiteSettings } from "@/lib/site-settings/types";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { VillaListing } from "@/lib/villas/types";
import { formatVillaPrice } from "../listing/villa-price";
import { findFact } from "./helpers";

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
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthLabel = monthStart.toLocaleString("th-TH", { month: "long", year: "numeric" });
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstWeekday = monthStart.getDay();
  const daySlots = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => {
    if (index < firstWeekday) {
      return null;
    }
    return index - firstWeekday + 1;
  });
  const checkIn = findFact(content.facts, "เช็คอิน");
  const checkOut =
    findFact(content.facts, "เช็คเอ้า") ??
    findFact(content.facts, "เช็คเอาท์");
  const contactLinks = buildContactLinks(settings.contact);
  const phoneContacts = settings.contact.phoneContacts.map(withPhoneHref);

  return (
    <aside id={id} className="lg:self-start">
      <div className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-[var(--site-card-shadow)]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--site-border)]"
            disabled
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 text-sm font-black text-[var(--site-text)]">
            <CalendarDays className="h-4 w-4" />
            {monthLabel}
          </div>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--site-border)]"
            disabled
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs font-bold text-[var(--site-text)]">
          {daySlots.map((day, index) => {
            if (day === null) {
              return <span key={`empty-${index}`} className="h-8" aria-hidden="true" />;
            }

            const isToday = day === today.getDate();

              return (
              <span
                key={`${monthStart.getMonth()}-${day}`}
                className={`rounded-md py-2 ${isToday ? "bg-[var(--site-primary)] text-[var(--site-on-primary)]" : "bg-[var(--site-primary-soft)] text-[var(--site-primary)]"}`}
              >
                {day}
              </span>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl border border-[var(--site-primary)] bg-[var(--site-primary-soft)] p-3 text-sm text-[var(--site-muted)]">
          <p className="flex items-center justify-between gap-3 text-xs font-black text-[var(--site-primary)]">สถานะ</p>
          <p className="mt-2 text-xs leading-6">ติดต่อแอดมินเพื่อยืนยันช่วงวันที่ว่าง</p>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--site-primary)] bg-[var(--site-primary-soft)] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--site-muted)]">
            เช็คอิน / เช็คเอาท์
          </p>
          <p className="mt-1 text-lg font-black text-[var(--site-text)]">
            {checkIn ?? "14:00"} - {checkOut ?? "12:00"}
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--site-border)] p-3 text-sm">
          <p className="font-black text-[var(--site-text)]">
            {formatVillaPrice(listing.price)} / คืน
          </p>
          <p className="mt-1 text-xs text-[var(--site-muted)]">
            เช็คอิน {checkIn ?? "14:00"} · เช็คเอาท์ {checkOut ?? "12:00"}
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
