"use client";

import { MapPin, Menu, X } from "lucide-react";
import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import { useState } from "react";
import { buildSiteAssetProxyUrl } from "@/lib/public-image-proxy";
import type { SiteSettings } from "@/lib/site-settings/types";

const navItems = [
  { href: "/", label: "หน้าแรก" },
  { href: "/search", label: "ค้นหาบ้านพัก" },
  { href: "/guides", label: "บทความ" },
  { href: "/#recommendations", label: "รีวิว" },
];

interface SiteHeaderProps {
  settings: SiteSettings;
}

export function SiteHeader({ settings }: SiteHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const bankNotice = `กรุณาโอนเงิน ชื่อบัญชี ${settings.bank.accountName} `;
  const bankAccount = `${settings.bank.bankName} เลขที่ ${settings.bank.accountNumber}`;

  const logoImageSrc =
    buildSiteAssetProxyUrl(settings.logoImage.url, { quality: 75, width: 128 }) ??
    settings.logoImage.url;

  return (
    <header className="sticky top-0 z-50 bg-[var(--site-primary)] text-[var(--site-on-primary)]">
      <div className="border-b border-[color:var(--site-on-primary)] bg-[var(--site-primary)]/95 shadow-[0_1px_1px_rgba(0,0,0,0.05)] backdrop-blur-[6px]">
        <div className="relative flex min-h-[90px] w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a
            href="/"
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-white/10">
              <Image
                src={logoImageSrc}
                alt={settings.logoImage.alt}
                fill
                sizes="44px"
                className="object-cover"
                priority
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-semibold leading-7 sm:text-2xl sm:leading-8">
                {settings.siteName}
              </span>
              <span className="block text-[11px] leading-4 text-[var(--site-on-primary)] sm:text-sm sm:leading-5">
                {bankNotice}{" "}
                <br className="sm:hidden" />
                <span className="inline-flex rounded-full font-semibold text-[var(--site-accent-on-dark)]">
                  {bankAccount}
                </span>{" "}
                เท่านั้น
              </span>
            </span>
          </a>

          <div className="hidden shrink-0 items-center justify-end gap-8 lg:flex">
            <nav className="flex h-16 items-center justify-end gap-8 text-2xl font-semibold leading-8">
              {navItems.map((item) => (
                <a
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className="whitespace-nowrap transition hover:text-[var(--site-accent)]"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <a
              href="/#contact"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--site-surface)] px-4 text-sm font-medium leading-5 text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
            >
              <MapPin className="h-4 w-4" />
              จองเลย
            </a>
          </div>

          <button
            type="button"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/30 bg-white/10 text-[var(--site-on-primary)] shadow-[0_10px_24px_rgba(0,0,0,0.12)] lg:hidden"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? "ปิดเมนู" : "เปิดเมนู"}
            onClick={() => {
              setIsMenuOpen((current) => !current);
            }}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {isMenuOpen ? (
            <div className="absolute left-4 right-4 top-[calc(100%-4px)] z-50 overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] shadow-[0_18px_48px_rgba(2,35,31,0.22)] lg:hidden">
              <div className="grid divide-y divide-[var(--site-border)] text-base font-semibold">
                {navItems.map((item) => (
                  <a
                    key={`mobile-${item.href}-${item.label}`}
                    href={item.href}
                    className="px-4 py-3"
                    onClick={() => {
                      setIsMenuOpen(false);
                    }}
                  >
                    {item.label}
                  </a>
                ))}
                <a
                  href="/#contact"
                  className="flex items-center gap-2 px-4 py-3 text-[var(--site-primary)]"
                  onClick={() => {
                    setIsMenuOpen(false);
                  }}
                >
                  <MapPin className="h-4 w-4" />
                  จองเลย
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
