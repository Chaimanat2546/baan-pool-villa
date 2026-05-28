import { BedDouble, MapPin, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { VillaListing } from "@/lib/villas/types";

interface VillaCardProps {
  villa: VillaListing;
  preload?: boolean;
}

function getVillaTitle(villa: VillaListing): string {
  return `พูลวิลล่า ${villa.id}`;
}

function formatPrice(price: number): string {
  return price.toLocaleString("th-TH");
}

export function VillaCard({ villa, preload = false }: VillaCardProps) {
  const visibleAmenities = villa.amenities.slice(0, 3);

  return (
    <Link
      href={`/villas/${villa.id}`}
      className="group block overflow-hidden rounded-[24px] border border-[#e2e8f0] bg-white p-px shadow-[0_10px_15px_-3px_rgba(0,0,0,0.05),0_4px_6px_-2px_rgba(0,0,0,0.05)] transition hover:-translate-y-1 hover:shadow-[0_18px_28px_-8px_rgba(15,47,53,0.18)]"
    >
      <div className="relative h-[216px] w-full overflow-hidden rounded-[23px] rounded-b-none bg-[#e6efeb]">
        {villa.coverImage ? (
          <Image
            src={villa.coverImage}
            alt={getVillaTitle(villa)}
            fill
            preload={preload}
            sizes="(max-width: 768px) 290px, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center bg-[#e8f0ec] text-sm font-semibold text-[#55746b]">
            ไม่มีรูปภาพ
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex min-w-0 items-start justify-between gap-3 pb-2">
          <h2 className="min-w-0 truncate text-lg font-semibold leading-7 text-[#064e3b]">
            {getVillaTitle(villa)}
          </h2>
          <span className="flex shrink-0 items-center gap-1 pt-1 text-sm leading-5 text-[#94a3b8]">
            <MapPin className="h-4 w-4" />
            <span className="max-w-[96px] truncate">{villa.zoneLabel}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pb-3 text-xs leading-4 text-[#334155]">
          <span className="inline-flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5 text-[#064e3b]" />
            {villa.bedrooms.toLocaleString("th-TH")} ห้องนอน
          </span>
          <span className="text-sm leading-5 text-[#94a3b8]">•</span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-[#064e3b]" />
            รองรับ {villa.people.toLocaleString("th-TH")} คน
          </span>
        </div>

        {visibleAmenities.length > 0 ? (
          <div className="flex min-h-[22px] flex-wrap gap-1 pb-3">
            {visibleAmenities.map((amenity) => (
              <span
                key={amenity.key}
                className="max-w-full truncate rounded-full bg-[#fef3c7] px-3 py-1 text-xs font-semibold leading-4 text-[#334155]"
              >
                {amenity.label}
              </span>
            ))}
          </div>
        ) : (
          <div className="min-h-[34px] pb-3 text-xs leading-5 text-[#94a3b8]">
            ไม่มีข้อมูลสิ่งอำนวยความสะดวก
          </div>
        )}

        <div className="flex items-end justify-between gap-3">
          <p className="min-w-0 text-[#064e3b]">
            <span className="text-sm leading-5">เริ่มต้น</span>{" "}
            <span className="text-lg leading-7">{formatPrice(villa.price)}</span>{" "}
            <span className="text-sm leading-5">บาท / คืน</span>
          </p>
          <span className="shrink-0 text-sm leading-5 text-[#eab308]">ดูรายละเอียด</span>
        </div>
      </div>
    </Link>
  );
}
