import { BedDouble, MapPin, Users } from "lucide-react";
import Image from "next/image";

import type { VillaListing } from "@/lib/villas/types";

interface VillaCardProps {
  villa: VillaListing;
  titleHeadingLevel?: "h2" | "h3";
  preload?: boolean;
}

function getVillaTitle(villa: VillaListing): string {
  return `พูลวิลล่า ${villa.id}`;
}

function formatPrice(price: number): string {
  return price.toLocaleString("th-TH");
}

export function VillaCard({
  villa,
  titleHeadingLevel = "h2",
  preload = false,
}: VillaCardProps) {
  const visibleAmenities = villa.amenities.slice(0, 3);
  const TitleTag = titleHeadingLevel;

  return (
    <a
      href={`/villas/${villa.id}`}
      className="group block overflow-hidden rounded-[24px] border border-[var(--site-border)] bg-[var(--site-surface)] p-px shadow-[0_10px_15px_-3px_rgba(0,0,0,0.05),0_4px_6px_-2px_rgba(0,0,0,0.05)] transition hover:-translate-y-1 hover:border-[var(--site-border-strong)] hover:shadow-[0_18px_28px_-8px_rgba(15,47,53,0.18)]"
    >
      <div className="relative h-[216px] w-full overflow-hidden rounded-[23px] rounded-b-none bg-[var(--site-surface-tint)]">
        {villa.coverImage ? (
          <Image
            src={villa.coverImage}
            alt={getVillaTitle(villa)}
            fill
            preload={preload}
            quality={60}
            sizes="(max-width: 640px) 290px, (max-width: 1024px) 50vw, 325px"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center bg-[var(--site-surface-tint)] text-sm font-semibold text-[var(--site-muted)]">
            ไม่มีรูปภาพ
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex min-w-0 items-start justify-between gap-3 pb-2">
          <TitleTag className="min-w-0 truncate text-lg font-semibold leading-7 text-[var(--site-text)]">
            {getVillaTitle(villa)}
          </TitleTag>
          <span className="flex shrink-0 items-center gap-1 pt-1 text-sm leading-5 text-[var(--site-muted)]">
            <MapPin className="h-4 w-4" />
            <span className="max-w-[96px] truncate">{villa.zoneLabel}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pb-3 text-xs leading-4 text-[var(--site-muted)]">
          <span className="inline-flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5 text-[var(--site-primary)]" />
            {villa.bedrooms.toLocaleString("th-TH")} ห้องนอน
          </span>
          <span className="text-sm leading-5 text-[var(--site-muted)]">•</span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-[var(--site-primary)]" />
            รองรับ {villa.people.toLocaleString("th-TH")} คน
          </span>
        </div>

        {visibleAmenities.length > 0 ? (
          <div className="flex min-h-[22px] flex-wrap gap-1 pb-3">
            {visibleAmenities.map((amenity) => (
              <span
                key={amenity.key}
                className="max-w-full truncate rounded-full bg-[var(--site-accent-soft)] px-3 py-1 text-xs font-semibold leading-4 text-[var(--site-text)]"
              >
                {amenity.label}
              </span>
            ))}
          </div>
        ) : (
          <div className="min-h-[34px] pb-3 text-xs leading-5 text-[var(--site-muted)]">
            ไม่มีข้อมูลสิ่งอำนวยความสะดวก
          </div>
        )}

        <div className="flex items-end justify-between gap-3">
          <p className="min-w-0 text-[var(--site-text)]">
            <span className="text-sm leading-5">เริ่มต้น</span>{" "}
            <span className="text-lg leading-7">{formatPrice(villa.price)}</span>{" "}
            <span className="text-sm leading-5">บาท / คืน</span>
          </p>
          <span className="shrink-0 text-sm leading-5 text-[var(--site-primary)]">ดูรายละเอียด</span>
        </div>
      </div>
    </a>
  );
}
