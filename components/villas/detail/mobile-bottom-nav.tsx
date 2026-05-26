import { CalendarDays, Home, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import type { VillaListing } from "@/lib/villas/types";
import { MockBadge } from "./shared";

export function MobileBottomNav({ listing }: { listing: VillaListing }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dbe7e3] bg-white/95 px-5 pb-4 pt-3 shadow-[0_-14px_34px_rgba(6,63,53,0.12)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-[357px] grid-cols-4 items-center gap-2 text-[11px] font-black text-[#064d3d]">
        <Link href="/" className="flex flex-col items-center gap-1 rounded-2xl px-2 py-1.5">
          <Home className="h-5 w-5" />
          หน้าแรก
        </Link>
        <Link href="#contact" className="flex flex-col items-center gap-1 rounded-2xl px-2 py-1.5">
          <CalendarDays className="h-5 w-5" />
          จอง
        </Link>
        <Link
          href="/"
          className="flex flex-col items-center gap-1 rounded-2xl px-2 py-1.5"
          aria-label={`โทรสอบถามพูลวิลล่า ${listing.id}`}
        >
          <Phone className="h-5 w-5" />
          โทร
          <MockBadge className="px-1 py-0 text-[9px]" />
        </Link>
        <Link href="/" className="flex flex-col items-center gap-1 rounded-2xl bg-[#064d3d] px-2 py-2 text-white">
          <MessageCircle className="h-5 w-5" />
          LINE
          <MockBadge className="border-white/40 bg-white/15 px-1 py-0 text-[9px] text-white" />
        </Link>
      </div>
    </nav>
  );
}
