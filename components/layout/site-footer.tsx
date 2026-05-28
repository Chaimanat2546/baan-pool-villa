import Image from "next/image";
import Link from "next/link";
import type { SiteSettings } from "@/lib/site-settings/types";

const menuItems = [
  { href: "/", label: "หน้าแรก" },
  { href: "/search", label: "ค้นหาบ้านพัก" },
  { href: "/#recommendations", label: "รีวิว" },
  { href: "/#cafes", label: "สถานที่ท่องเที่ยว" },
];

const contactItems = [
  "คุณเกม : 0617485213 ช่วง 07.00-15.00",
  "คุณโก้ : 0657329919 ช่วง 16.00-02.00",
  "LINE : @baanpoolvilla",
  "Facebook : Poolvillas บ้านพักพูลวิลล่าพัทยา",
];

interface SiteFooterProps {
  settings: SiteSettings;
}

export function SiteFooter({ settings }: SiteFooterProps) {
  return (
    <footer className="bg-[var(--site-primary)] pb-16 text-[var(--site-on-primary)] lg:pb-0">
      <div className="mx-auto grid max-w-[1292px] gap-10 px-6 pb-16 pt-14 sm:px-8 lg:grid-cols-[1.45fr_0.7fr_0.9fr] lg:gap-20 lg:px-6 lg:pb-16 lg:pt-[60px]">
        <div>
          <div className="flex items-center gap-3">
            <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[18px] border-4 border-white bg-white/10">
              <Image
                src={settings.logoImage.url}
                alt={settings.logoImage.alt}
                fill
                sizes="64px"
                className="object-cover"
              />
            </span>
            <div className="min-w-0">
              <h2 className="text-[26px] font-semibold leading-8 text-[var(--site-on-primary)]">
                {settings.siteName}
              </h2>
              <p className="mt-[7px] text-sm leading-5 text-[var(--site-on-primary)]">
                กรุณาโอนเงิน ชื่อบัญชี คุณ อาภัสรา จินดาวา{" "}
                <br className="sm:hidden" />
                <span className="font-medium text-[var(--site-accent)]">
                  ธนาคารกสิกรไทย เลขที่ 398-289-7482
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
              <Link
                key={item.href}
                href={item.href}
                className="text-[var(--site-on-primary)] opacity-60 transition hover:opacity-100"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div>
          <h3 className="text-lg font-semibold leading-7 text-[var(--site-on-primary)]">
            ติดต่อเรา
          </h3>
          <div className="mt-[22px] grid gap-3 text-base leading-6">
            {contactItems.map((item) => (
              <p
                key={item}
                className="text-[var(--site-on-primary)] opacity-60"
              >
                {item}
              </p>
            ))}
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
