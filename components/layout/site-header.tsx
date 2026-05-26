"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const navItems = [
  { href: "/", label: "หน้าแรก" },
  { href: "/search", label: "บ้านทั้งหมด" },
  { href: "/#recommendations", label: "รีวิว" },
  { href: "/#contact", label: "ติดต่อ" },
];

export function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-[#064d3d] text-white">
      <div className="relative mx-auto flex min-h-[88px] w-full max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-6 lg:min-h-16 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/45 bg-white/10">
            <Image
              src="/images/logo.jpg"
              alt="Pool Villas Pattaya"
              fill
              sizes="48px"
              className="object-cover"
            />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-lg font-black">Pool Villas Pattaya</span>
            <span className="block truncate text-[11px] text-emerald-100">
              ครบครัน ใกล้ทะเล จองง่ายในที่เดียว
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-bold lg:flex">
          {navItems.map((item) => (
            <Link key={`${item.href}-${item.label}`} href={item.href} className="hover:text-emerald-100">
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/#contact"
          className="hidden rounded-full bg-white px-4 py-2 text-xs font-black text-[#064d3d] transition hover:bg-emerald-50 sm:inline-flex"
        >
          จองเลย
        </Link>

        <button
          type="button"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/25 bg-white/10 text-white shadow-[0_10px_24px_rgba(0,0,0,0.12)] lg:hidden"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "ปิดเมนู" : "เปิดเมนู"}
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {isMenuOpen ? (
          <div className="absolute left-5 right-5 top-[78px] z-50 overflow-hidden rounded-2xl border border-white/20 bg-white text-[#064d3d] shadow-[0_18px_48px_rgba(2,35,31,0.22)] lg:hidden">
            <div className="grid divide-y divide-[#dbe7e3] text-sm font-black">
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
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
