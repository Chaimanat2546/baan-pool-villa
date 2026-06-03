import { CalendarDays, ChevronLeft, ChevronRight, Phone } from "lucide-react";
import Link from "next/link";
import { LineIcon, MessengerIcon } from "@/components/layout/contact-icons";
import { buildContactLinks, withPhoneHref } from "@/lib/site-contact";
import type { SiteSettings } from "@/lib/site-settings/types";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { VillaListing } from "@/lib/villas/types";
import { formatVillaPrice } from "../listing/villa-price";
import { MOCK_CALENDAR_DAYS } from "./constants";
import { findFact } from "./helpers";
import { MockBadge } from "./shared";

export function BookingSidebar({
  content,
  listing,
  settings,
}: {
  content: VillaDetailContent;
  listing: VillaListing;
  settings: SiteSettings;
}) {
  const checkIn = findFact(content.facts, "เช็คอิน");
  const checkOut = findFact(content.facts, "เช็คเอาต์");
  const contactLinks = buildContactLinks(settings.contact);
  const phoneContacts = settings.contact.phoneContacts.map(withPhoneHref);

  return (
    <aside id="contact" className="lg:self-start">
      <div className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-[var(--site-card-shadow)]">
        <div className="flex items-center justify-between">
          <button className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--site-border)]">
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 text-sm font-black text-[var(--site-text)]">
            <CalendarDays className="h-4 w-4" />
            October 2024
          </div>

          <button className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--site-border)]">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <MockBadge className="mt-3" />

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-bold">
          {MOCK_CALENDAR_DAYS.map((day) => (
            <span
              key={day.day}
              className={`rounded-md py-2 ${
                day.state === "booked"
                  ? "bg-red-500 text-white"
                  : day.state === "promo"
                    ? "bg-yellow-300 text-[#0f172a]"
                    : day.state === "selected"
                      ? "bg-[var(--site-primary)] text-[var(--site-on-primary)]"
                      : "bg-[var(--site-primary-soft)] text-[var(--site-primary)]"
              }`}
            >
              {day.day}
            </span>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[var(--site-primary-soft)] p-3 text-[11px] font-semibold text-[var(--site-muted)]">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-yellow-300" />
            วันหยุดยาว
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--site-primary)]" />
            จองแล้ว
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            ปิดจองแล้ว
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-400" />
            ราคา FE
          </span>
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

          <Link
            href={contactLinks.messenger}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--site-primary)] bg-[var(--site-primary-soft)] px-4 py-3 text-sm font-black text-[var(--site-primary)] transition hover:bg-[var(--site-surface-tint)]"
          >
            <MessengerIcon className="h-6 w-6" />
            แชทเลย
          </Link>

          <Link
            href={contactLinks.line}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--site-primary)] px-4 py-3 text-sm font-black text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)]"
          >
            <LineIcon className="h-6 w-6" />
            จองผ่าน LINE
          </Link>
        </div>
      </div>
    </aside>
  );
}
