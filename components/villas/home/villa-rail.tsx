import { ArrowRight } from "lucide-react";
import Link from "next/link";

import type { VillaListing } from "@/lib/villas/types";

import { VillaCard } from "../listing/villa-card";
import { ScrollRail } from "./scroll-rail";
import { SectionHeader } from "./section-header";

interface VillaRailProps {
  cta?: boolean | { label: string; href: string };
  description: string;
  id?: string;
  title: string;
  villas: VillaListing[];
};

export function VillaRail({ cta, description, id, title, villas }: VillaRailProps) {
  const ctaConfig =
    cta === true
      ? { label: "ดูบ้านพักทั้งหมด", href: "/search" }
      : cta || null;

  return (
    <section
      id={id}
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-14"
    >
      <SectionHeader title={title} description={description} />
      <ScrollRail
        label={title}
        className="-mx-4 mt-4 gap-5 px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:gap-6 lg:px-8 lg:py-8"
      >
        {villas.slice(0, 12).map((villa, index) => (
          <div key={villa.id} className="w-[290px] shrink-0 snap-start">
            <VillaCard villa={villa} preload={index === 0} />
          </div>
        ))}
      </ScrollRail>
      {ctaConfig ? (
        <div className="mt-8 text-center">
          <Link
            href={ctaConfig.href}
            className="inline-flex items-center gap-2 rounded-xl bg-[#064d3d] px-5 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(6,77,61,0.22)]"
          >
            {ctaConfig.label} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </section>
  );
}
