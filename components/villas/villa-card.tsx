import { Bath, BedDouble, MapPin, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { VillaListing } from "@/lib/villas/types";

type VillaCardProps = {
  villa: VillaListing;
  priority?: boolean;
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

function getVillaTitle(villa: VillaListing): string {
  return `พูลวิลล่า ${villa.id}`;
}

export function VillaCard({ villa, priority = false }: VillaCardProps) {
  const amenities = villa.amenities.slice(0, 3);

  return (
    <Link
      href={`/villas/${villa.id}`}
      className="group block overflow-hidden rounded-[22px] border border-[#dbe7e3] bg-white shadow-[0_14px_42px_rgba(6,63,53,0.09)] transition hover:-translate-y-1 hover:shadow-[0_18px_52px_rgba(6,63,53,0.14)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#e6efeb]">
        {villa.coverImage ? (
          <Image
            src={villa.coverImage}
            alt={getVillaTitle(villa)}
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center bg-[#e8f0ec] text-sm font-semibold text-[#55746b]">
            ไม่มีรูปภาพ
          </div>
        )}
        <div className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-sm font-bold text-[#d88d00] shadow-sm">
          {currencyFormatter.format(villa.price)}
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-[#063f35]">
            {getVillaTitle(villa)}
          </h2>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-[#55746b]">
            <MapPin className="h-4 w-4 shrink-0 text-[#0f5a66]" />
            <span className="truncate">
              {villa.zoneLabel} · ห่างทะเล {villa.distanceToSea}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="flex min-w-0 items-center gap-1.5 rounded-xl bg-[#f4f8f5] px-3 py-2 text-[#063f35]">
            <Users className="h-4 w-4 shrink-0 text-[#0f5a66]" />
            <span className="truncate">{villa.people} คน</span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5 rounded-xl bg-[#f4f8f5] px-3 py-2 text-[#063f35]">
            <BedDouble className="h-4 w-4 shrink-0 text-[#0f5a66]" />
            <span className="truncate">{villa.bedrooms} ห้อง</span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5 rounded-xl bg-[#f4f8f5] px-3 py-2 text-[#063f35]">
            <Bath className="h-4 w-4 shrink-0 text-[#0f5a66]" />
            <span className="truncate">{villa.bathrooms} ห้อง</span>
          </div>
        </div>

        <div className="flex min-h-8 flex-wrap gap-2">
          {amenities.length > 0 ? (
            amenities.map((amenity) => (
              <span
                key={amenity.key}
                className="max-w-full truncate rounded-full border border-[#dbe7e3] px-3 py-1 text-xs font-semibold text-[#55746b]"
              >
                {amenity.label}
              </span>
            ))
          ) : (
            <span className="text-sm text-[#7b928a]">ไม่มีข้อมูลสิ่งอำนวยความสะดวก</span>
          )}
        </div>
      </div>
    </Link>
  );
}
