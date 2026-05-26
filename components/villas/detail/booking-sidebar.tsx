import { CalendarDays, ChevronLeft, ChevronRight, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { VillaListing } from "@/lib/villas/types";
import { formatVillaPrice } from "../listing/villa-price";
import { MOCK_CALENDAR_DAYS } from "./constants";
import { findFact } from "./helpers";
import { MockBadge } from "./shared";

export function BookingSidebar({ content, listing }: { content: VillaDetailContent; listing: VillaListing }) {
  const checkIn = findFact(content.facts, "เช็คอิน");
  const checkOut = findFact(content.facts, "เช็คเอาต์");
  return (
    <aside id="contact" className="lg:self-start">
      <div className="rounded-2xl border border-[#dbe7e3] bg-white p-4 shadow-[0_14px_42px_rgba(6,63,53,0.09)]">
        <div className="flex items-center justify-between">
          <button className="grid h-9 w-9 place-items-center rounded-xl border border-[#dbe7e3]">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 text-sm font-black text-[#064d3d]">
            <CalendarDays className="h-4 w-4" />
            October 2024
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-xl border border-[#dbe7e3]">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <MockBadge className="mt-3" />
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-bold">
          {MOCK_CALENDAR_DAYS.map((day) => (
            <span
              key={day.day}
              className={`rounded-md py-2 ${
                day.state === "booked"
                  ? "bg-red-500 text-white"
                  : day.state === "promo"
                    ? "bg-yellow-300 text-[#064d3d]"
                    : day.state === "selected"
                      ? "bg-[#064d3d] text-white"
                      : "bg-[#f3f8f6] text-[#0f5a66]"
              }`}
            >
              {day.day}
            </span>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[#edf4f1] p-3 text-[11px] font-semibold text-[#55746b]">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-yellow-300" />
            วันหยุดยาว
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#064d3d]" />
            จองแล้ว
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            ปิดจองแล้ว
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-400" />
            ราคา FE
          </span>
        </div>
        <div className="mt-4 rounded-xl border border-[#dbe7e3] p-3 text-sm">
          <p className="font-black text-[#063f35]">{formatVillaPrice(listing.price)} / คืน</p>
          <p className="mt-1 text-xs text-[#6d867e]">
            เช็คอิน {checkIn ?? "14:00"} · เช็คเอาท์ {checkOut ?? "12:00"}
          </p>
        </div>
        <div className="mt-4 grid gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dbe7e3] px-4 py-3 text-sm font-black text-[#064d3d]"
          >
            <Phone className="h-4 w-4" />
            โทรเลย
            <MockBadge />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#0f5a66] bg-[#eefaf6] px-4 py-3 text-sm font-black text-[#064d3d]"
          >
            <MessageCircle className="h-4 w-4" />
            แชทเลย
            <MockBadge />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#064d3d] px-4 py-3 text-sm font-black text-white"
          >
            <MessageCircle className="h-4 w-4" />
            จองผ่าน LINE
            <MockBadge />
          </Link>
        </div>
      </div>
    </aside>
  );
}
