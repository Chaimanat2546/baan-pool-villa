import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import { FacebookPageTimeline } from "@/components/layout/facebook-page-timeline";
import { LEGAL_PAGE_PATHS } from "@/lib/legal-pages/types";
import { buildSiteAssetImageProxyPath, normalizePublicImageSourceUrl } from "@/lib/public-image-proxy";
import { SITE_LOGO_BACKGROUND_CLASSES, SITE_LOGO_BORDER_CLASSES } from "@/lib/site-settings/logo-background";
import { buildSiteThemeStyle } from "@/lib/site-settings/colors";
import type { SiteSettings } from "@/lib/site-settings/types";
import type { SiteContactSettings } from "@/lib/site-contact-settings/types";

const FALLBACK_LOGO_IMAGE_SRC = "/images/logo.jpg";

const menuItems = [
  { href: "/", label: "หน้าแรก" },
  { href: "/search?guests=2&bedrooms=1&maxPrice=58900", label: "ค้นหาบ้านพัก" },
  { href: "/guides", label: "บทความ" },
  { href: LEGAL_PAGE_PATHS.terms, label: "เงื่อนไขการใช้งาน" },
  { href: LEGAL_PAGE_PATHS.privacy, label: "นโยบายความเป็นส่วนตัว" },
];

interface SiteFooterProps {
  contactSettings: SiteContactSettings;
  settings: SiteSettings;
}

export function SiteFooter({ contactSettings, settings }: SiteFooterProps) {
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
  const logoImageSrc = normalizePublicImageSourceUrl(settings.logoImage.url)
    ? buildSiteAssetImageProxyPath("logo")
    : FALLBACK_LOGO_IMAGE_SRC;
  const logoBackgroundClass =
    SITE_LOGO_BACKGROUND_CLASSES[settings.logoBackground ?? "white"];
  const logoBorderClass =
    SITE_LOGO_BORDER_CLASSES[settings.logoBackground ?? "white"];
  const contactItems = [
    ...contactSettings.contact.phoneContacts.map(
      (contact, index) => ({
        href: null,
        key: `phone-${index}-${contact.name}-${contact.phone}-${contact.time}`,
        text: `${contact.name} : ${contact.phone} ${contact.time}`,
      }),
    ),
    {
      href: contactSettings.contact.lineUrl,
      key: "line",
      text: `LINE : ${contactSettings.contact.lineId}`,
    },
    {
      href: contactSettings.contact.messengerUrl,
      key: "messenger",
      text: "Messenger",
    },
  ];
  const facebookPagePluginSrc = contactSettings.contact.showFacebookTimeline ? (() => {
    try {
      const configuredUrl = new URL(contactSettings.contact.messengerUrl);
      const pagePathParts = configuredUrl.pathname
        .split("/")
        .filter(Boolean);
      const facebookPageUrl = ["facebook.com", "www.facebook.com"].includes(
        configuredUrl.hostname,
      )
        ? configuredUrl
        : configuredUrl.protocol === "https:" &&
            configuredUrl.hostname === "m.me" &&
            pagePathParts.length === 1
          ? new URL(
              `https://www.facebook.com/${encodeURIComponent(pagePathParts[0])}`,
            )
          : null;

      if (!facebookPageUrl || facebookPageUrl.pathname === "/") return null;

      return `https://www.facebook.com/plugins/page.php?${new URLSearchParams({
        adapt_container_width: "true",
        height: "500",
        hide_cover: "true",
        href: facebookPageUrl.toString(),
        show_facepile: "false",
        small_header: "false",
        tabs: "timeline",
        width: "500",
      })}`;
    } catch {
      return null;
    }
  })() : null;

  return (
    <footer className="bg-[var(--site-primary)] pb-28 text-[var(--site-footer-link)] md:pb-0" style={siteThemeStyle}>
      <div className="mx-auto grid max-w-[1292px] gap-10 px-6 pb-16 pt-14 sm:px-8 lg:grid-cols-[1.45fr_0.7fr_0.9fr] lg:gap-20 lg:px-6 lg:pb-16 lg:pt-[60px]">
        <div>
          <div className="flex items-center gap-3">
            <span className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-[18px] border-4 p-2 ${logoBackgroundClass} ${logoBorderClass}`}>
              <Image
                src={logoImageSrc}
                alt={settings.logoImage.alt}
                fill
                quality={75}
                sizes="64px"
                className="object-contain"
              />
            </span>
            <div className="min-w-0">
              <h2 className="text-[26px] font-semibold leading-8 text-[var(--site-footer-link)]">
                {settings.siteName}
              </h2>
              <p className="mt-[7px] text-sm leading-5 text-[var(--site-footer-link)]">
                กรุณาโอนเงิน{" "}
                <span className="inline-flex rounded-full font-medium text-[var(--site-bank-account-highlight)]">
                  ชื่อบัญชี {contactSettings.bank.accountName}
                </span>{" "}
                <br className="sm:hidden" />
                <span className="inline-flex rounded-full font-medium text-[var(--site-bank-name-highlight)]">
                  {contactSettings.bank.bankName}
                </span>{" "}
                <span className="inline-flex rounded-full font-medium text-[var(--site-bank-number-highlight)]">
                  เลขที่ {contactSettings.bank.accountNumber}
                </span>{" "}
                เท่านั้น
              </p>
            </div>
          </div>

          <p className="mt-4 max-w-[600px] text-sm leading-[21px] text-[var(--site-footer-link)] opacity-70">
            บ้านพักพูลวิลล่าสุดหรูใจกลางพัทยา พร้อมสระว่ายน้ำส่วนตัว
            เหมาะสำหรับครอบครัวและกลุ่มเพื่อน
          </p>

        </div>

        <nav aria-label="เมนูหลัก">
          <h3 className="text-lg font-semibold leading-7 text-[var(--site-footer-link)]">
            เมนูหลัก
          </h3>
          <div className="mt-[22px] grid gap-4 text-base leading-6">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[var(--site-footer-link)] opacity-80 transition hover:text-[var(--site-footer-link-hover)] hover:opacity-100"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <div>
          <h3 className="text-lg font-semibold leading-7 text-[var(--site-footer-link)]">
            ติดต่อเรา
          </h3>
          <div className="mt-[22px] grid gap-3 text-base leading-6">
            {contactItems.map((item) =>
              item.href ? (
                <a
                  className="text-[var(--site-footer-link)] opacity-80 transition hover:text-[var(--site-footer-link-hover)] hover:opacity-100"
                  href={item.href}
                  key={item.key}
                  rel="noreferrer"
                  target="_blank"
                >
                  {item.text}
                </a>
              ) : (
                <p
                  key={item.key}
                  className="text-[var(--site-footer-link)] opacity-80"
                >
                  {item.text}
                </p>
              ),
            )}
          </div>
        </div>

        {facebookPagePluginSrc ? (
          <FacebookPageTimeline src={facebookPagePluginSrc} />
        ) : null}
      </div>

      <div className="mx-auto max-w-[1292px] px-6 pb-8 text-center text-sm leading-5 text-[var(--site-footer-link)] opacity-50 sm:px-8 lg:px-6">
        <p>
          © {new Date().getFullYear()} Baan Pool Villas. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
