"use client";

import { Menu, Phone, X } from "lucide-react";
import { LineIcon } from "@/components/layout/contact-icons";
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
import { buildPhoneHref } from "@/lib/site-contact";
import { SITE_LOGO_BACKGROUND_CLASSES } from "@/lib/site-settings/logo-background";
import { buildSiteThemeStyle } from "@/lib/site-settings/colors";
import type { SiteSettings } from "@/lib/site-settings/types";

const navItems = [
  { href: "/", label: "หน้าแรก" },
  { href: "/search?guests=2&bedrooms=1&maxPrice=58900", label: "ค้นหาบ้านพัก" },
  { href: "/guides", label: "บทความ" },
];

interface SiteHeaderProps {
  previewMode?: boolean;
  settings: SiteSettings;
}

export function SiteHeader({ previewMode = false, settings }: SiteHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const logoImageSrc =
    normalizePublicImageSourceUrl(settings.logoImage.url) ??
    settings.logoImage.url;
  const logoBackgroundClass =
    SITE_LOGO_BACKGROUND_CLASSES[settings.logoBackground ?? "white"];
  const primaryPhone = settings.contact.phoneContacts[0];
  const primaryPhoneHref = primaryPhone
    ? buildPhoneHref(primaryPhone.phone)
    : null;
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
    if (previewMode) return;
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
  }, [previewMode]);

  return (
    <header
      className={`${previewMode ? "" : "sticky top-0 z-50 transition-transform duration-300 ease-out"} bg-[var(--site-primary)] text-[var(--site-on-primary)] ${
        isHeaderHidden && !isMenuOpen ? "-translate-y-full" : "translate-y-0"
      }`}
      data-header-hidden={isHeaderHidden && !isMenuOpen ? "true" : "false"}
    >
      <div className={`${previewMode ? "" : "border-b border-[color:var(--site-on-primary)] shadow-[0_1px_1px_rgba(0,0,0,0.05)] backdrop-blur-[6px]"} bg-[var(--site-primary)]/95`}>
        <div className="relative flex min-h-[90px] w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:grid lg:min-h-[72px] lg:grid-cols-[1fr_auto_1fr] lg:py-0 lg:px-8">
          <a
            href="/"
            className="flex min-w-0 flex-1 items-center gap-2 lg:absolute lg:left-8 lg:top-0 lg:z-10 lg:grid lg:h-full lg:w-[30rem] lg:grid-cols-[3.5rem_minmax(0,1fr)] lg:grid-rows-[26px_38px] lg:gap-x-3"
          >
            <span className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border-4 border-white p-1.5 lg:row-span-2 lg:h-14 lg:w-14 lg:self-center ${logoBackgroundClass}`}>
              <Image
                src={logoImageSrc}
                alt={settings.logoImage.alt}
                fill
                quality={75}
                sizes="(min-width: 1024px) 56px, 44px"
                className="object-contain"
                priority
              />
            </span>
            <span className="min-w-0 lg:contents">
              <span className="block truncate text-lg font-semibold leading-7 sm:text-2xl sm:leading-8 lg:col-start-2 lg:row-start-1 lg:self-end lg:translate-y-2 lg:text-xl lg:leading-7">
                {settings.siteName}
              </span>
              {!previewMode ? <span className="block text-[11px] leading-4 text-[var(--site-on-primary)] sm:text-sm sm:leading-5 lg:col-start-2 lg:row-start-2 lg:-mt-1 lg:flex lg:items-center lg:gap-x-2 lg:whitespace-nowrap lg:pt-1 lg:border-t lg:border-[color:var(--site-on-primary)]/25 lg:text-xs lg:leading-4">
                <span>กรุณาโอนเงิน</span>{" "}
                <span className="ml-2 inline-flex gap-1 rounded-full font-semibold text-[var(--site-bank-account-highlight)] lg:ml-0">
                  <span>ชื่อบัญชี</span>
                  <span>{settings.bank.accountName}</span>
                </span>{" "}
                <br className="sm:hidden" />
                <span className="ml-2 inline-flex rounded-full font-semibold text-[var(--site-bank-name-highlight)] lg:ml-0">
                  {settings.bank.bankName}
                </span>{" "}
                <span className="ml-2 inline-flex rounded-full font-semibold text-[var(--site-bank-number-highlight)] lg:ml-0">
                  เลขที่ {settings.bank.accountNumber}
                </span>{" "}
                <span className="ml-2 lg:ml-0">เท่านั้น</span>
              </span> : null}
            </span>
          </a>

          <nav className="hidden h-12 items-center justify-center gap-8 text-xl font-semibold leading-7 lg:col-start-2 lg:flex">
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
          <div className="hidden items-center justify-self-end gap-2 lg:col-start-3 lg:flex">
            {primaryPhoneHref && primaryPhoneHref !== "#" ? (
              <a
                href={primaryPhoneHref}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--site-surface)] px-4 text-sm font-semibold leading-5 text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                {primaryPhone?.phone}
              </a>
            ) : null}
            <a
              href={settings.contact.lineUrl}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--site-surface)] px-3 text-sm font-semibold leading-5 text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
              rel="noreferrer"
              target="_blank"
            >
              <LineIcon className="h-5 w-5" />
              {settings.contact.lineId}
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
                      className="px-5 py-4 text-[var(--site-text)] transition hover:bg-[var(--site-primary-soft)] hover:text-[var(--site-text)]"
                    >
                      {item.label}
                    </a>
                  </SheetClose>
                ))}
                {primaryPhoneHref && primaryPhoneHref !== "#" ? (
                  <SheetClose asChild>
                    <a
                      href={primaryPhoneHref}
                      className="flex items-center gap-2 px-5 py-4 text-[var(--site-text)] transition hover:bg-[var(--site-primary-soft)]"
                    >
                      <Phone className="h-4 w-4" aria-hidden="true" />
                      {primaryPhone?.phone}
                    </a>
                  </SheetClose>
                ) : null}
                <SheetClose asChild>
                  <a
                    href={settings.contact.lineUrl}
                    className="flex items-center gap-2 px-5 py-4 text-[var(--site-text)] transition hover:bg-[var(--site-primary-soft)]"
                    rel="noreferrer"
                    target="_blank"
                  >
                    <LineIcon className="h-5 w-5" />
                    {settings.contact.lineId}
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
