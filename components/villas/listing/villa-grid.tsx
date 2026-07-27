import { SearchX } from "lucide-react";

import type { SiteVillaCardStyle } from "@/lib/site-web-styles/types";
import type { VillaListing } from "@/lib/villas/types";

import { VillaCard } from "./villa-card";

interface VillaGridProps {
  villaCardStyle?: SiteVillaCardStyle;
  villas: VillaListing[];
};

export function VillaGrid({ villaCardStyle, villas }: VillaGridProps) {
  if (villas.length === 0) {
    return (
      <div className="grid min-h-72 place-items-center rounded-[24px] border border-dashed border-[var(--site-border-strong)] bg-[var(--site-surface)] px-6 text-center">
        <div className="max-w-md">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
            <SearchX className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-[var(--site-text)]">
            ไม่พบบ้านพักที่ตรงกับเงื่อนไข
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--site-muted)]">
            ลองปรับทำเล จำนวนผู้เข้าพัก ห้องนอน สิ่งอำนวยความสะดวก หรือช่วงราคา
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {villas.map((villa, index) => (
        <VillaCard
          key={villa.id}
          villa={villa}
          preload={index === 0}
          villaCardStyle={villaCardStyle}
        />
      ))}
    </div>
  );
}
