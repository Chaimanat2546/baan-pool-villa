import Link from "next/link";
import type { VillaListing } from "@/lib/villas/types";

export function Breadcrumbs({ listing }: { listing: VillaListing }) {
  return (
    <div className="mx-auto hidden w-full max-w-7xl items-center gap-2 px-4 py-4 text-xs font-semibold text-[#6d867e] sm:px-6 lg:flex lg:px-8">
      <Link href="/" className="hover:text-[#064d3d]">
        Home
      </Link>
      <span>{">"}</span>
      <Link href="/" className="hover:text-[#064d3d]">
        Pattaya Villas
      </Link>
      <span>{">"}</span>
      <span className="text-[#064d3d]">{listing.zoneLabel}</span>
    </div>
  );
}
