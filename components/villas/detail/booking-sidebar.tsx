"use client";

import { buildContactLinks, withPhoneHref } from "@/lib/site-contact";
import type { SiteContactSettings } from "@/lib/site-contact-settings/types";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { VillaListing } from "@/lib/villas/types";
import { formatVillaPrice } from "../listing/villa-price";
import { BookingCalendarPanel } from "./booking-calendar-panel";
import { BookingSidebarContactActions } from "./booking-sidebar-contact-actions";
import { findFact } from "./helpers";

export { clearBookingCalendarClientCacheForTests } from "./booking-calendar-client-cache";

export function BookingSidebar({
  content,
  id = "contact",
  listing,
  contactSettings,
}: {
  content: VillaDetailContent;
  id?: string;
  listing: VillaListing;
  contactSettings: SiteContactSettings;
}) {
  const checkIn = findFact(content.facts, "เช็คอิน") ?? "14:00";
  const checkOut = findFact(content.facts, "เช็คเอาต์") ?? "12:00";
  const contactLinks = buildContactLinks(contactSettings.contact);
  const phoneContacts = contactSettings.contact.phoneContacts.map(withPhoneHref);
  const primaryPhoneContact = phoneContacts[0];

  return (
    <aside id={id} className="lg:self-start">
      <div
        className="rounded-[1.75rem] border border-[var(--site-border)] bg-[linear-gradient(145deg,var(--site-surface),var(--site-surface-soft))] p-3 shadow-[var(--site-card-shadow)] ring-1 ring-[var(--site-primary)]/10"
        data-booking-card-shell="true"
      >
        <BookingCalendarPanel
          contactLinks={contactLinks}
          fallbackPrice={listing.price}
          listingId={listing.id}
          primaryPhoneContact={primaryPhoneContact}
        />

        <div className="mt-4 rounded-xl border border-[var(--site-primary)] bg-[var(--site-primary-soft)] p-3 text-sm text-[var(--site-muted)]">
          <p className="flex items-center justify-between gap-3 text-xs font-black text-[var(--site-primary)]">
            สถานะ
          </p>
          <p className="mt-2 text-xs leading-6">
            ติดต่อแอดมินเพื่อยืนยันช่วงวันที่ว่าง
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--site-primary)] bg-[var(--site-primary-soft)] p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--site-muted)]">
            เช็คอิน / เช็คเอาท์
          </p>
          <p className="mt-1 text-lg font-black text-[var(--site-text)]">
            เช็คอิน {checkIn} · เช็คเอาท์ {checkOut}
          </p>
        </div>

        <div className={listing.price === null ? "hidden" : "mt-4 rounded-xl border border-[var(--site-border)] p-3 text-sm"}>
          <p className="font-black text-[var(--site-text)]">
            {formatVillaPrice(listing.price)} / คืน
          </p>
        </div>

        <BookingSidebarContactActions
          contactLinks={contactLinks}
          listing={listing}
          phoneContacts={phoneContacts}
          trackingLocation="booking_sidebar"
        />
      </div>
    </aside>
  );
}
