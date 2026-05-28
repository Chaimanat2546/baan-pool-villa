import { Bath, BedDouble, Users } from "lucide-react";

interface VillaStatsProps {
  people: number;
  bedrooms: number;
  bathrooms: number;
  variant?: "card" | "detail";
  className?: string;
};

export function VillaStats({
  people,
  bedrooms,
  bathrooms,
  variant = "card",
  className = "",
}: VillaStatsProps) {
  const itemClass =
    variant === "detail"
      ? "flex min-w-0 items-center gap-1.5 rounded-2xl bg-white px-2.5 py-3 text-xs font-semibold text-[#063f35] shadow-sm ring-1 ring-[#dbe7e3] sm:gap-2 sm:px-4 sm:text-sm"
      : "flex min-w-0 items-center gap-1.5 rounded-xl bg-[#f4f8f5] px-3 py-2 text-[#063f35]";
  const iconClass =
    variant === "detail" ? "h-4 w-4 sm:h-5 sm:w-5" : "h-4 w-4";

  const stats = [
    { icon: Users, value: people, label: "คน" },
    { icon: BedDouble, value: bedrooms, label: "ห้องนอน" },
    { icon: Bath, value: bathrooms, label: "ห้องน้ำ" },
  ];

  return (
    <div className={`grid grid-cols-3 gap-2 text-sm ${className}`}>
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <div key={stat.label} className={itemClass}>
            <Icon className={`${iconClass} shrink-0 text-[#0f5a66]`} />
            <span className="min-w-0 whitespace-nowrap">
              {stat.value.toLocaleString("th-TH")} {stat.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
