import type { Amenity } from "@/lib/villas/types";

interface VillaAmenitiesProps {
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
      ? "max-w-full rounded-full border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--site-primary)]"
      : "max-w-full truncate rounded-full border border-[var(--site-border)] px-3 py-1 text-xs font-semibold text-[var(--site-muted)]";

  if (visibleAmenities.length === 0) {
    return (
      <div className={`text-sm text-[var(--site-muted)] ${className}`}>
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
