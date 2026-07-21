import { CreditCard, MessageCircle, Phone } from "lucide-react";
import { buildPhoneHref } from "@/lib/site-contact";
import type { SiteContactSettings } from "@/lib/site-contact-settings/types";

interface ContactSectionProps {
  settings: SiteContactSettings;
}

export function ContactSection({ settings }: ContactSectionProps) {
  const contactCards = [
    ...settings.contact.phoneContacts.map((contact, index) => ({
      detail: contact.phone,
      icon: Phone,
      key: `phone-${index}-${contact.name}-${contact.phone}-${contact.time}`,
      label: `${contact.name} :`,
      title: contact.time,
      href: buildPhoneHref(contact.phone),
    })),
    {
      detail: settings.contact.lineId,
      icon: MessageCircle,
      key: "line",
      label: "LINE ID:",
      title: "LINE Official",
      href: settings.contact.lineUrl,
    },
  ];
  const bankRows = [
    {
      label: "ธนาคาร",
      value: settings.bank.bankName,
    },
    {
      label: "เลขบัญชี",
      value: settings.bank.accountNumber,
    },
    {
      label: "ชื่อบัญชี",
      value: settings.bank.accountName,
    },
  ];

  return (
    <section id="contact" className="bg-[var(--site-surface)] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h2 className="text-3xl font-black leading-tight text-[var(--site-text)]">
            ช่องทางการติดต่อ
          </h2>
          <p className="mt-2 text-base text-[var(--site-muted)]">พร้อมให้บริการและตอบทุกคำถาม</p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {contactCards.map((card) => {
            const Icon = card.icon;

            return (
              <a
                href={card.href}
                target={card.href.startsWith("http") ? "_blank" : undefined}
                rel={card.href.startsWith("http") ? "noopener noreferrer" : undefined}
                key={card.key}
                className="block rounded-[20px] border border-[var(--site-border)] bg-[var(--site-surface)] p-7 shadow-[0_8px_24px_rgba(15,47,53,0.08)] transition-all hover:-translate-y-1 hover:border-[var(--site-border-strong)] hover:shadow-[0_12px_32px_rgba(15,47,53,0.12)] active:translate-y-0 sm:p-8"
              >
                <div className="flex items-center gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="text-xl font-black leading-8 text-[var(--site-text)] sm:text-2xl">
                    {card.title}
                  </h3>
                </div>
                <p className="mt-7 flex flex-wrap items-center gap-2 text-lg font-black text-[var(--site-text)] sm:text-xl">
                  <span>{card.label}</span>
                  <span className="text-[var(--site-accent)]">{card.detail}</span>
                </p>
              </a>
            );
          })}
        </div>

        <article className="mt-8 rounded-2xl border border-[var(--site-border)] bg-[var(--site-primary)] p-5 text-[var(--site-on-primary)] shadow-[0_8px_24px_rgba(15,47,53,0.12)] sm:p-6 lg:p-7">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--site-surface)] text-[var(--site-primary)]">
              <CreditCard className="h-6 w-6" />
            </span>
            <div>
              <h3 className="text-2xl font-black leading-tight sm:text-3xl">
                ข้อมูลการโอนเงิน
              </h3>
              <p className="mt-1 text-xs text-[var(--site-on-primary)] opacity-90">กรุณาโอนเข้าบัญชีนี้เท่านั้น</p>
            </div>
          </div>

          <div className="mt-7 rounded-xl bg-[var(--site-surface)] p-3 text-[var(--site-muted)]">
            <dl className="divide-y divide-[var(--site-border)]">
              {bankRows.map((row) => (
                <div
                  key={row.label}
                  className="grid gap-1 py-3 text-sm sm:grid-cols-[160px_1fr] sm:items-center sm:text-base"
                >
                  <dt>{row.label}</dt>
                  <dd className="font-black text-[var(--site-accent)] sm:text-right">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 rounded-lg bg-[var(--site-accent-soft)] px-3 py-2 text-center text-xs leading-5 text-[var(--site-text)]">
              หลังโอนเงินแล้ว กรุณาส่งหลักฐานการโอนมาที่ LINE หรือ Messenger
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
