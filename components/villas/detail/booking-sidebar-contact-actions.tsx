import { AnalyticsContactLink } from "@/components/layout/analytics-contact-link";
import { Phone } from "lucide-react";
import { LineIcon, MessengerIcon } from "@/components/layout/contact-icons";
import type { VillaListing } from "@/lib/villas/types";

interface BookingSidebarContactActionsProps {
  contactLinks: { line: string; messenger: string };
  listing: VillaListing;
  phoneContacts: {
    href: string;
    name: string;
    phone: string;
    time: string;
  }[];
}

export function BookingSidebarContactActions({
  contactLinks,
  listing,
  phoneContacts,
}: BookingSidebarContactActionsProps) {
  return (
    <div className="mt-4 grid gap-3">
      <div className="grid gap-2">
        {phoneContacts.map((contact, index) => (
          <AnalyticsContactLink
            className="inline-flex items-center justify-between gap-3 rounded-xl border border-[var(--site-border)] px-4 py-3 text-sm font-black text-[var(--site-text)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-primary-soft)]"
            channel="phone"
            villaId={listing.id}
            href={contact.href}
            key={index}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <Phone className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {contact.name} : {contact.phone}
              </span>
            </span>
            <span className="shrink-0 text-[11px] text-[var(--site-muted)]">
              {contact.time.replace("ช่วง ", "")}
            </span>
          </AnalyticsContactLink>
        ))}
      </div>

      <AnalyticsContactLink
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--site-primary)] bg-[var(--site-primary-soft)] px-4 py-3 text-sm font-black text-[var(--site-primary)] transition hover:bg-[var(--site-surface-tint)]"
        channel="chat"
        villaId={listing.id}
        href={contactLinks.messenger}
        rel="noreferrer"
        target="_blank"
      >
        <MessengerIcon className="h-6 w-6" />
        แชทเลย
      </AnalyticsContactLink>

      <AnalyticsContactLink
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--site-primary)] px-4 py-3 text-sm font-black text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)]"
        channel="line"
        villaId={listing.id}
        href={contactLinks.line}
        rel="noreferrer"
        target="_blank"
      >
        <LineIcon className="h-6 w-6" />
        จองผ่าน LINE
      </AnalyticsContactLink>
    </div>
  );
}
