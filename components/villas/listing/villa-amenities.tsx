import type { Amenity } from "@/lib/villas/types";

type VillaAmenitiesProps = {
  amenities: Amenity[];
  limit?: number;
  variant?: "card" | "detail";
  emptyLabel?: string;
  className?: string;
};

export function VillaAmenities({
  amenities,
  limit,
  variant = "card",
  emptyLabel = "ไม่มีข้อมูลสิ่งอำนวยความสะดวก",
  className = "",
}: VillaAmenitiesProps) {
  const visibleAmenities =
    typeof limit === "number" ? amenities.slice(0, limit) : amenities;
  const chipClass =
    variant === "detail"
      ? "max-w-full rounded-full border border-[#c7dad4] bg-white px-3 py-1.5 text-sm font-semibold text-[#0f5a66]"
      : "max-w-full truncate rounded-full border border-[#dbe7e3] px-3 py-1 text-xs font-semibold text-[#55746b]";

  if (visibleAmenities.length === 0) {
    return (
      <div className={`text-sm text-[#7b928a] ${className}`}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={`flex min-h-8 flex-wrap gap-2 ${className}`}>
      {visibleAmenities.map((amenity) => (
        <span key={amenity.key} className={chipClass}>
          {amenity.label}
        </span>
      ))}
    </div>
  );
}
