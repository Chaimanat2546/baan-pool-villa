import { MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { VillaListing } from "@/lib/villas/types";

import { VillaAmenities } from "./villa-amenities";
import { VillaPrice } from "./villa-price";
import { VillaStats } from "./villa-stats";

type VillaCardProps = {
  villa: VillaListing;
  preload?: boolean;
};

function getVillaTitle(villa: VillaListing): string {
  return `พูลวิลล่า ${villa.id}`;
}

export function VillaCard({ villa, preload = false }: VillaCardProps) {
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
            preload={preload}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center bg-[#e8f0ec] text-sm font-semibold text-[#55746b]">
            ไม่มีรูปภาพ
          </div>
        )}
        <VillaPrice
          price={villa.price}
          variant="badge"
          className="absolute left-4 top-4"
        />
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

        <VillaStats
          people={villa.people}
          bedrooms={villa.bedrooms}
          bathrooms={villa.bathrooms}
        />

        <VillaAmenities amenities={villa.amenities} limit={3} />
      </div>
    </Link>
  );
}
