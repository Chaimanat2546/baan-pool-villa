"use client";

import { MapPin, Menu, X } from "lucide-react";
import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useEffect, useRef, useState } from "react";
import { normalizePublicImageSourceUrl } from "@/lib/public-image-proxy";
import { SITE_LOGO_BACKGROUND_CLASSES } from "@/lib/site-settings/logo-background";
import { buildSiteThemeStyle } from "@/lib/site-settings/colors";
import type { SiteSettings } from "@/lib/site-settings/types";

const navItems = [
  { href: "/", label: "หน้าแรก" },
  { href: "/search?guests=2&bedrooms=1&maxPrice=58900", label: "ค้นหาบ้านพัก" },
  { href: "/guides", label: "บทความ" },
];

interface SiteHeaderProps {
  settings: SiteSettings;
}

export function SiteHeader({ settings }: SiteHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const logoImageSrc =
    normalizePublicImageSourceUrl(settings.logoImage.url) ??
    settings.logoImage.url;
  const logoBackgroundClass =
    SITE_LOGO_BACKGROUND_CLASSES[settings.logoBackground ?? "white"];
  const siteThemeStyle = buildSiteThemeStyle({
    accentColor: settings.accentColor,
    bankHighlightColor: settings.bankHighlightColor,
    bankAccountHighlightColor: settings.bankAccountHighlightColor,
    bankNameHighlightColor: settings.bankNameHighlightColor,
    bankNumberHighlightColor: settings.bankNumberHighlightColor,
    footerLinkColor: settings.footerLinkColor,
    footerLinkHoverColor: settings.footerLinkHoverColor,
    headerLinkColor: settings.headerLinkColor,
    headerLinkHoverColor: settings.headerLinkHoverColor,
    primaryColor: settings.primaryColor,
  });
  const mobileMenuThemeStyle = {
    ...siteThemeStyle,
    background: `linear-gradient(180deg, ${siteThemeStyle["--site-surface"]}, ${siteThemeStyle["--site-surface-soft"]})`,
  };

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    const updateHeaderVisibility = () => {
      frameRef.current = null;
      const currentScrollY = Math.max(window.scrollY, 0);
      const distance = currentScrollY - lastScrollYRef.current;

      if (currentScrollY < 24) {
        setIsHeaderHidden(false);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (Math.abs(distance) < 16) {
        return;
      }

      setIsHeaderHidden(distance > 0);
      lastScrollYRef.current = currentScrollY;
    };

    const onScroll = () => {
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(updateHeaderVisibility);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 bg-[var(--site-primary)] text-[var(--site-on-primary)] transition-transform duration-300 ease-out ${
        isHeaderHidden && !isMenuOpen ? "-translate-y-full" : "translate-y-0"
      }`}
      data-header-hidden={isHeaderHidden && !isMenuOpen ? "true" : "false"}
    >
      <div className="border-b border-[color:var(--site-on-primary)] bg-[var(--site-primary)]/95 shadow-[0_1px_1px_rgba(0,0,0,0.05)] backdrop-blur-[6px]">
        <div className="relative flex min-h-[90px] w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a
            href="/"
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <span className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border-4 border-white p-1.5 ${logoBackgroundClass}`}>
              <Image
                src={logoImageSrc}
                alt={settings.logoImage.alt}
                fill
                quality={75}
                sizes="44px"
                className="object-contain"
                priority
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-semibold leading-7 sm:text-2xl sm:leading-8">
                {settings.siteName}
              </span>
              <span className="block text-[11px] leading-4 text-[var(--site-on-primary)] sm:text-sm sm:leading-5">
                กรุณาโอนเงิน{" "}
                <span className="inline-flex rounded-full font-semibold text-[var(--site-bank-account-highlight)]">
                  ชื่อบัญชี {settings.bank.accountName}
                </span>{" "}
                <br className="sm:hidden" />
                <span className="inline-flex rounded-full font-semibold text-[var(--site-bank-name-highlight)]">
                  {settings.bank.bankName}
                </span>{" "}
                <span className="inline-flex rounded-full font-semibold text-[var(--site-bank-number-highlight)]">
                  เลขที่ {settings.bank.accountNumber}
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
                  className="whitespace-nowrap text-[var(--site-header-link)] transition hover:text-[var(--site-header-link-hover)]"
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

          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/30 bg-white/10 text-[var(--site-on-primary)] shadow-[0_10px_24px_rgba(0,0,0,0.12)] lg:hidden"
                aria-expanded={isMenuOpen}
                aria-label={isMenuOpen ? "ปิดเมนู" : "เปิดเมนู"}
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              showCloseButton={false}
              className="w-screen max-w-none border-[var(--site-border)] p-0 text-[var(--site-text)] shadow-none data-[state=open]:fade-in data-[state=open]:slide-in-from-right motion-reduce:transition-none sm:max-w-none lg:hidden"
              style={mobileMenuThemeStyle}
            >
              <SheetHeader className="sr-only">
                <SheetTitle>เมนูหลัก</SheetTitle>
              </SheetHeader>
              <SheetClose asChild>
                <button
                  type="button"
                  className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)] shadow-[var(--site-card-shadow)] transition hover:bg-[var(--site-primary-soft)]"
                  aria-label="ปิดเมนู"
                >
                  <X className="h-5 w-5" />
                </button>
              </SheetClose>
              <nav className="mt-20 grid divide-y divide-[var(--site-border)] border-y border-[var(--site-border)] bg-[var(--site-surface)] text-base font-semibold shadow-[var(--site-card-shadow)]">
                {navItems.map((item) => (
                  <SheetClose key={`mobile-${item.href}-${item.label}`} asChild>
                    <a
                      href={item.href}
                      className="px-5 py-4 text-[var(--site-header-link)] transition hover:bg-[var(--site-primary-soft)] hover:text-[var(--site-header-link-hover)]"
                    >
                      {item.label}
                    </a>
                  </SheetClose>
                ))}
                <SheetClose asChild>
                  <a
                    href="/#contact"
                    className="flex items-center gap-2 px-5 py-4 text-[var(--site-header-link)] transition hover:bg-[var(--site-primary-soft)] hover:text-[var(--site-header-link-hover)]"
                  >
                    <MapPin className="h-4 w-4" />
                    จองเลย
                  </a>
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
