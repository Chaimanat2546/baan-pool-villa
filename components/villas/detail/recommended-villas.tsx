import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { VillaListing } from "@/lib/villas/types";
import { formatVillaPrice } from "../listing/villa-price";
import { MockBadge } from "./shared";

export function RecommendedVillas({ listing }: { listing: VillaListing }) {
  const cards = Array.from({ length: 4 }, (_, index) => index + 1);
  return (
    <section id="recommendations" className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-6 lg:px-8">
      <div className="text-left lg:text-center">
        <h2 className="text-2xl font-black text-[#064d3d]">บ้านพักแนะนำ</h2>
        <p className="mt-2 text-sm text-[#55746b]">
          ยังไม่มี API บ้านแนะนำ จึง mock ไว้ที่ FE ตรงสิ่งนี้
        </p>
        <MockBadge className="mt-2" />
      </div>
      <div className="-mx-0.5 mt-8 flex snap-x gap-6 overflow-x-auto px-0.5 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card}
            className="w-[290px] shrink-0 snap-start overflow-hidden rounded-2xl border border-[#dbe7e3] bg-white shadow-[0_10px_28px_rgba(6,63,53,0.08)] sm:w-auto"
          >
            <div className="relative aspect-[4/3]">
              {listing.coverImage ? (
                <Image src={listing.coverImage} alt="บ้านพักแนะนำ mock" fill sizes="280px" className="object-cover" />
              ) : null}
              <MockBadge className="absolute left-3 top-3" />
            </div>
            <div className="p-4">
              <h3 className="font-black text-[#063f35]">Sunset Party Villa</h3>
              <p className="mt-1 text-xs font-semibold text-[#6d867e]">{listing.zoneLabel}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["คาราโอเกะ", "สไลเดอร์", "BBQ"].map((tag) => (
                  <span key={tag} className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
                    {tag}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-sm font-black text-[#064d3d]">
                เริ่มต้น {formatVillaPrice(listing.price)} / คืน
              </p>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-[#064d3d] px-5 py-3 text-sm font-black text-white"
        >
          ดูบ้านพักทั้งหมด
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
