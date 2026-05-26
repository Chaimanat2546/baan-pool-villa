"use client";

import { MapPin, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const navItems = [
  { href: "/", label: "หน้าแรก" },
  { href: "/search", label: "ค้นหาบ้านพัก" },
  { href: "/#recommendations", label: "รีวิว" },
  { href: "/#cafes", label: "สถานที่ท่องเที่ยว" },
];

const bankNotice = "กรุณาโอนเงิน ชื่อบัญชี";
const bankAccount = "บริษัท พูลวิลล่า พัทยา จำกัด ธนาคาร กสิกรไทย 137-1-17528-4";

export function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#064e3b] text-white">
      <div className="border-b border-white bg-[#064e3b]/95 shadow-[0_1px_1px_rgba(0,0,0,0.05)] backdrop-blur-[6px]">
        <div className="relative flex min-h-[90px] w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-3">
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-white/10">
              <Image
                src="/images/logo.jpg"
                alt="Pool Villas Pattaya"
                fill
                sizes="44px"
                className="object-cover"
                priority
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-semibold leading-7 sm:text-2xl sm:leading-8">
                Pool Villas Pattaya
              </span>
              <span className="block text-[11px] leading-4 text-white sm:text-sm sm:leading-5">
                {bankNotice}{" "}
                <span className="text-[#eab308]">{bankAccount}</span>{" "}
                เท่านั้น
              </span>
            </span>
          </Link>

          <div className="hidden shrink-0 items-center justify-end gap-8 lg:flex">
            <nav className="flex h-16 items-center justify-end gap-8 text-2xl font-semibold leading-8">
              {navItems.map((item) => (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className="whitespace-nowrap transition hover:text-emerald-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <Link
              href="/#contact"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-medium leading-5 text-[#064e3b] transition hover:bg-emerald-50"
            >
              <MapPin className="h-4 w-4" />
              จองเลย
            </Link>
          </div>

          <button
            type="button"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/30 bg-white/10 text-white shadow-[0_10px_24px_rgba(0,0,0,0.12)] lg:hidden"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? "ปิดเมนู" : "เปิดเมนู"}
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {isMenuOpen ? (
            <div className="absolute left-4 right-4 top-[calc(100%-4px)] z-50 overflow-hidden rounded-2xl border border-white/20 bg-white text-[#064e3b] shadow-[0_18px_48px_rgba(2,35,31,0.22)] lg:hidden">
              <div className="grid divide-y divide-[#dbe7e3] text-base font-semibold">
                {navItems.map((item) => (
                  <Link
                    key={`mobile-${item.href}-${item.label}`}
                    href={item.href}
                    className="px-4 py-3"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/#contact"
                  className="flex items-center gap-2 px-4 py-3 text-[#064e3b]"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <MapPin className="h-4 w-4" />
                  จองเลย
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
