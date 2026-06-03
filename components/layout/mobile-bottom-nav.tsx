"use client";

import { Phone, PhoneCall, X } from "lucide-react";
import { useState } from "react";
import { buildContactLinks, withPhoneHref } from "@/lib/site-contact";
import type { SiteSettings } from "@/lib/site-settings/types";
import { FacebookIcon, LineIcon } from "./contact-icons";
import { cn } from "@/lib/utils";

interface MobileBottomNavProps {
  settings: SiteSettings;
}

const bottomNavActionClass =
  "relative flex min-h-[4.85rem] min-w-0 flex-col items-center justify-center gap-1.5 px-1.5 text-center text-sm leading-none text-[var(--site-text)] transition duration-150 active:scale-[0.98]";

const separatedBottomNavActionClass = `${bottomNavActionClass} before:absolute before:bottom-4 before:left-0 before:top-4 before:w-px before:bg-[var(--site-border)]`;

const largeIconClass = "grid h-11 w-11 place-items-center rounded-full";

const phoneIconClass = "h-6 w-6";
const messengerIconClass = "h-6 w-6";
const lineIconClass = "h-7 w-7";
const bottomNavLabelClass = "truncate text-xs font-semibold";

export function MobileBottomNav({ settings }: MobileBottomNavProps) {
  const [isPhoneSheetOpen, setIsPhoneSheetOpen] = useState(false);
  const contactLinks = buildContactLinks(settings.contact);
  const phoneContacts = settings.contact.phoneContacts.map(withPhoneHref);

  return (
    <>
      <nav
        aria-label="ช่องทางติดต่อด่วน"
        className="fixed inset-x-0 bottom-3 z-50 px-3 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-3 overflow-hidden rounded-[2rem] border border-white/80 bg-[var(--site-surface)] px-1 py-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.16)]">
          <button
            type="button"
            className={bottomNavActionClass}
            onClick={() => {
              setIsPhoneSheetOpen(true);
            }}
          >
            <span
              className={cn(
                largeIconClass,
                "bg-[#080b45] text-white shadow-[0_14px_28px_rgba(8,11,69,0.24)]",
              )}
            >
              <PhoneCall className={phoneIconClass} strokeWidth={2.4} />
            </span>
            <span className={bottomNavLabelClass}>โทร</span>
          </button>

          <a
            href={contactLinks.messenger}
            aria-label="แชทผ่าน Messenger"
            className={separatedBottomNavActionClass}
          >
            <span
              className={cn(
                largeIconClass,
                "bg-[#1877f2] text-white shadow-[0_14px_28px_rgba(24,119,242,0.24)]",
              )}
            >
              <FacebookIcon className={messengerIconClass} />
            </span>
            <span className={bottomNavLabelClass}>แชท</span>
          </a>

          <a
            href={contactLinks.line}
            aria-label="ติดต่อผ่าน LINE"
            className={separatedBottomNavActionClass}
          >
            <span
              className={cn(
                largeIconClass,
                "bg-[#06c755] text-white shadow-[0_14px_28px_rgba(6,199,85,0.24)]",
              )}
            >
              <LineIcon className={lineIconClass} />
            </span>
            <span className={bottomNavLabelClass}>LINE</span>
          </a>
        </div>
      </nav>

      {isPhoneSheetOpen ? (
        <div
          className="fixed inset-0 z-[80] lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="ปิดตัวเลือกโทร"
            className="absolute inset-0 bg-[#021d19]/55"
            onClick={() => {
              setIsPhoneSheetOpen(false);
            }}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-[var(--site-surface)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-24px_60px_rgba(2,29,25,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[var(--site-muted)]">
                  เลือกผู้ติดต่อ
                </p>
                <h2 className="text-xl font-black text-[var(--site-text)]">
                  โทรสอบถามบ้านพัก
                </h2>
              </div>
              <button
                type="button"
                aria-label="ปิดตัวเลือกโทร"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)]"
                onClick={() => {
                  setIsPhoneSheetOpen(false);
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {phoneContacts.map((contact) => (
                <a
                  key={contact.phone}
                  href={contact.href}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4 text-left"
                >
                  <span>
                    <span className="block text-base font-black text-[var(--site-text)]">
                      {contact.name} : {contact.phone}
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-[var(--site-muted)]">
                      {contact.time}
                    </span>
                  </span>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--site-primary)] text-[var(--site-on-primary)]">
                    <Phone className="h-5 w-5" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
