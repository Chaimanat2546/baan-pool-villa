import type { VillaListing } from "@/lib/villas/types";

export function Breadcrumbs({ listing }: { listing: VillaListing }) {
  return (
    <div className="mx-auto hidden w-full max-w-7xl items-center gap-2 px-4 py-4 text-xs font-semibold text-[var(--site-muted)] sm:px-6 lg:flex lg:px-8">
      <a href="/" className="hover:text-[var(--site-primary)]">
        Home
      </a>
      <span>{">"}</span>
      <a href="/" className="hover:text-[var(--site-primary)]">
        Pattaya Villas
      </a>
      <span>{">"}</span>
      <span className="text-[var(--site-primary)]">{listing.zoneLabel}</span>
    </div>
  );
}
