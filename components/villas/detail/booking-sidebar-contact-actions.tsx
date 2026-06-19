import { Phone } from "lucide-react";
import { LineIcon, MessengerIcon } from "@/components/layout/contact-icons";

interface BookingSidebarContactActionsProps {
  contactLinks: { line: string; messenger: string };
  phoneContacts: {
    href: string;
    name: string;
    phone: string;
    time: string;
  }[];
}

export function BookingSidebarContactActions({
  contactLinks,
  phoneContacts,
}: BookingSidebarContactActionsProps) {
  return (
    <div className="mt-4 grid gap-3">
      <div className="grid gap-2">
        {phoneContacts.map((contact, index) => (
          <a
            className="inline-flex items-center justify-between gap-3 rounded-xl border border-[var(--site-border)] px-4 py-3 text-sm font-black text-[var(--site-text)] transition hover:border-[var(--site-primary)] hover:bg-[var(--site-primary-soft)]"
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
          </a>
        ))}
      </div>

      <a
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--site-primary)] bg-[var(--site-primary-soft)] px-4 py-3 text-sm font-black text-[var(--site-primary)] transition hover:bg-[var(--site-surface-tint)]"
        href={contactLinks.messenger}
        rel="noreferrer"
        target="_blank"
      >
        <MessengerIcon className="h-6 w-6" />
        แชทเลย
      </a>

      <a
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--site-primary)] px-4 py-3 text-sm font-black text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)]"
        href={contactLinks.line}
        rel="noreferrer"
        target="_blank"
      >
        <LineIcon className="h-6 w-6" />
        จองผ่าน LINE
      </a>
    </div>
  );
}
