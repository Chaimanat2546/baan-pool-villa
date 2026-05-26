import { SearchX } from "lucide-react";

import type { VillaListing } from "@/lib/villas/types";

import { VillaCard } from "./villa-card";

type VillaGridProps = {
  villas: VillaListing[];
};

export function VillaGrid({ villas }: VillaGridProps) {
  if (villas.length === 0) {
    return (
      <div className="grid min-h-72 place-items-center rounded-[24px] border border-dashed border-[#cbded8] bg-white/70 px-6 text-center">
        <div className="max-w-md">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f4f8f5] text-[#0f5a66]">
            <SearchX className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-[#063f35]">
            ไม่พบบ้านพักที่ตรงกับเงื่อนไข
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#55746b]">
            ลองปรับทำเล จำนวนผู้เข้าพัก ห้องนอน สิ่งอำนวยความสะดวก หรือช่วงราคา
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {villas.map((villa, index) => (
        <VillaCard key={villa.id} villa={villa} priority={index < 3} />
      ))}
    </div>
  );
}
