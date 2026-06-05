import { ArrowRight } from "lucide-react";
import Link from "next/link";

import type { VillaListing } from "@/lib/villas/types";

import { VillaCard } from "../listing/villa-card";
import { ScrollRail } from "./scroll-rail";
import { SectionHeader } from "./section-header";

interface VillaRailCtaConfig {
  href: string;
  label: string;
}

interface VillaRailProps {
  cta?: boolean | VillaRailCtaConfig;
  description: string;
  id?: string;
  title: string;
  villas: VillaListing[];
}

const DEFAULT_CTA_CONFIG: VillaRailCtaConfig = {
  href: "/search",
  label: "\u0e14\u0e39\u0e1a\u0e49\u0e32\u0e19\u0e1e\u0e31\u0e01\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14",
};

function getVillaRailCtaConfig(
  cta: VillaRailProps["cta"],
): VillaRailCtaConfig | null {
  if (cta === true) {
    return DEFAULT_CTA_CONFIG;
  }

  if (cta === false || typeof cta === "undefined") {
    return null;
  }

  return cta;
}

export function VillaRail({
  cta,
  description,
  id,
  title,
  villas,
}: VillaRailProps) {
  const ctaConfig = getVillaRailCtaConfig(cta);

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
        {villas.slice(0, 12).map((villa) => (
          <div key={villa.id} className="w-[290px] shrink-0 snap-start">
            <VillaCard villa={villa} />
          </div>
        ))}
      </ScrollRail>
      {ctaConfig ? (
        <div className="mt-8 text-center">
          <Link
            href={ctaConfig.href}
            prefetch={false}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--site-primary)] px-5 py-3 text-sm font-black text-[var(--site-on-primary)] shadow-[0_14px_30px_rgba(6,77,61,0.22)] transition hover:bg-[var(--site-primary-hover)]"
          >
            {ctaConfig.label} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </section>
  );
}
