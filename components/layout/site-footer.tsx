import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import { LEGAL_PAGE_PATHS } from "@/lib/legal-pages/types";
import { normalizePublicImageSourceUrl } from "@/lib/public-image-proxy";
import type { SiteSettings } from "@/lib/site-settings/types";

const FALLBACK_LOGO_IMAGE_SRC = "/images/logo.jpg";

const menuItems = [
  { href: "/", label: "หน้าแรก" },
  { href: "/search?guests=2&bedrooms=1&maxPrice=58900", label: "ค้นหาบ้านพัก" },
  { href: "/guides", label: "บทความ" },
  { href: LEGAL_PAGE_PATHS.terms, label: "เงื่อนไขการใช้งาน" },
  { href: LEGAL_PAGE_PATHS.privacy, label: "นโยบายความเป็นส่วนตัว" },
];

interface SiteFooterProps {
  settings: SiteSettings;
}

export function SiteFooter({ settings }: SiteFooterProps) {
  const logoImageSrc =
    normalizePublicImageSourceUrl(settings.logoImage.url) ??
    FALLBACK_LOGO_IMAGE_SRC;
  const contactItems = [
    ...settings.contact.phoneContacts.map(
      (contact, index) => ({
        href: null,
        key: `phone-${index}-${contact.name}-${contact.phone}-${contact.time}`,
        text: `${contact.name} : ${contact.phone} ${contact.time}`,
      }),
    ),
    {
      href: settings.contact.lineUrl,
      key: "line",
      text: `LINE : ${settings.contact.lineId}`,
    },
    {
      href: settings.contact.messengerUrl,
      key: "messenger",
      text: "Messenger",
    },
  ];

  return (
    <footer className="bg-[var(--site-primary)] pb-28 text-[var(--site-on-primary)] md:pb-0">
      <div className="mx-auto grid max-w-[1292px] gap-10 px-6 pb-16 pt-14 sm:px-8 lg:grid-cols-[1.45fr_0.7fr_0.9fr] lg:gap-20 lg:px-6 lg:pb-16 lg:pt-[60px]">
        <div>
          <div className="flex items-center gap-3">
            <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[18px] border-4 border-white bg-white/10">
              <Image
                src={logoImageSrc}
                alt={settings.logoImage.alt}
                fill
                quality={75}
                sizes="64px"
                className="object-cover"
              />
            </span>
            <div className="min-w-0">
              <h2 className="text-[26px] font-semibold leading-8 text-[var(--site-on-primary)]">
                {settings.siteName}
              </h2>
              <p className="mt-[7px] text-sm leading-5 text-[var(--site-on-primary)]">
                กรุณาโอนเงิน ชื่อบัญชี {settings.bank.accountName}{" "}
                <br className="sm:hidden" />
                <span className="font-medium text-[var(--site-accent-on-dark)]">
                  {settings.bank.bankName} เลขที่ {settings.bank.accountNumber}
                </span>{" "}
                เท่านั้น
              </p>
            </div>
          </div>

          <p className="mt-4 max-w-[600px] text-sm leading-[21px] text-[var(--site-on-primary)] opacity-70">
            บ้านพักพูลวิลล่าสุดหรูใจกลางพัทยา พร้อมสระว่ายน้ำส่วนตัว
            เหมาะสำหรับครอบครัวและกลุ่มเพื่อน
          </p>
        </div>

        <nav aria-label="เมนูหลัก">
          <h3 className="text-lg font-semibold leading-7 text-[var(--site-on-primary)]">
            เมนูหลัก
          </h3>
          <div className="mt-[22px] grid gap-4 text-base leading-6">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[var(--site-on-primary)] opacity-60 transition hover:opacity-100"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <div>
          <h3 className="text-lg font-semibold leading-7 text-[var(--site-on-primary)]">
            ติดต่อเรา
          </h3>
          <div className="mt-[22px] grid gap-3 text-base leading-6">
            {contactItems.map((item) =>
              item.href ? (
                <a
                  className="text-[var(--site-on-primary)] opacity-60 transition hover:opacity-100"
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
                  className="text-[var(--site-on-primary)] opacity-60"
                >
                  {item.text}
                </p>
              ),
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1292px] px-6 pb-8 text-center text-sm leading-5 text-[var(--site-on-primary)] opacity-50 sm:px-8 lg:px-6">
        <p>
          © {new Date().getFullYear()} Baan Pool Villas. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
