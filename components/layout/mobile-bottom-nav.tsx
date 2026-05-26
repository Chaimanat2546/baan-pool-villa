"use client";

import { MessageCircle, Phone, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const phoneContacts = [
  {
    href: "tel:0617485213",
    name: "คุณเกม",
    phone: "0617485213",
    time: "ช่วง 07.00-15.00",
  },
  {
    href: "tel:0657329919",
    name: "คุณโก้",
    phone: "0657329919",
    time: "ช่วง 16.00-02.00",
  },
];

function LineIcon() {
  return (
    <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#06c755] text-[8px] font-black leading-none text-white shadow-sm">
      LINE
    </span>
  );
}

function MessengerIcon() {
  return (
    <span className="grid h-7 w-7 place-items-center rounded-full bg-[#0a7cff] text-white shadow-sm">
      <MessageCircle className="h-4 w-4" />
    </span>
  );
}

export function MobileBottomNav() {
  const [isPhoneSheetOpen, setIsPhoneSheetOpen] = useState(false);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#dbe7e3] bg-white/95 px-4 py-2 shadow-[0_-10px_30px_rgba(6,63,53,0.12)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2 pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            className="flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border border-[#dbe7e3] bg-white px-2 text-xs font-semibold leading-none text-[#064e3b]"
            onClick={() => setIsPhoneSheetOpen(true)}
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#064e3b] text-white shadow-sm ">
              <Phone className="h-4 w-4" />
            </span>
            <span className="truncate">โทร</span>
          </button>

          <Link
            href="https://www.facebook.com/baanpoolvillas"
            className="flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border border-[#dbe7e3] bg-white px-2 text-xs font-semibold leading-none text-[#064e3b]"
          >
            <MessengerIcon />
            <span className="truncate">แชท</span>
          </Link>

          <Link
            href="https://line.me/R/ti/p/@baanpoolvilla"
            className="flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border border-[#dbe7e3] bg-white px-2 text-xs font-semibold leading-none text-[#064e3b]"
          >
            <LineIcon />
            <span className="truncate">LINE</span>
          </Link>
        </div>
      </nav>

      {isPhoneSheetOpen ? (
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="ปิดตัวเลือกโทร"
            className="absolute inset-0 bg-[#021d19]/55"
            onClick={() => setIsPhoneSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-24px_60px_rgba(2,29,25,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#55746b]">เลือกผู้ติดต่อ</p>
                <h2 className="text-xl font-black text-[#063f35]">โทรสอบถามบ้านพัก</h2>
              </div>
              <button
                type="button"
                aria-label="ปิดตัวเลือกโทร"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#dbe7e3] bg-white text-[#064e3b]"
                onClick={() => setIsPhoneSheetOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {phoneContacts.map((contact) => (
                <a
                  key={contact.phone}
                  href={contact.href}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-[#dbe7e3] bg-[#f8fbf7] p-4 text-left"
                >
                  <span>
                    <span className="block text-base font-black text-[#063f35]">
                      {contact.name} : {contact.phone}
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-[#55746b]">
                      {contact.time}
                    </span>
                  </span>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#064e3b] text-white">
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
