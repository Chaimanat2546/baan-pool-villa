interface VillaPriceProps {
  price: number | null;
  variant?: "badge" | "text";
  className?: string;
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

export function formatVillaPrice(price: number | null): string {
  return price === null ? "" : currencyFormatter.format(price);
}

export function VillaPrice({
  price,
  variant = "text",
  className = "",
}: VillaPriceProps) {
  const baseClass =
    variant === "badge"
      ? "rounded-full bg-[var(--site-surface)] px-3 py-1.5 text-sm font-bold text-[var(--site-accent)] shadow-sm"
      : "text-2xl font-black text-[var(--site-accent)]";

  return <span className={`${baseClass} ${className}`}>{formatVillaPrice(price)}</span>;
}
