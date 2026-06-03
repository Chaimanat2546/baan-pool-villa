"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";

import type { GuidePost } from "@/lib/guides/types";
import type { ResolvedHomeSection } from "@/lib/home-sections/types";
import type { SiteSettings } from "@/lib/site-settings/types";
import {
  filtersToSearchParams,
  getDefaultFilters,
  getMaxVillaPrice,
  getUniqueZones,
  normalizeFiltersForSearch,
} from "@/lib/villas/filters";
import type { VillaFilters, VillaListing } from "@/lib/villas/types";

import { ArticlesSection } from "./articles-section";
import { ContactSection } from "./contact-section";
import { DestinationsSection } from "./destinations-section";
import { FaqSection } from "./faq-section";
import { HeroSection } from "./hero-section";
import { VillaRail } from "./villa-rail";
import { WhyChooseSection } from "./why-choose-section";
import { TikTokSection } from "./tiktok-section";

interface HomePageProps {
  initialGuides?: GuidePost[];
  initialHomeSections?: ResolvedHomeSection[];
  initialVillas?: VillaListing[];
  settings: SiteSettings;
}

export function HomePage({
  initialGuides = [],
  initialHomeSections = [],
  initialVillas = [],
  settings,
}: HomePageProps) {
  const router = useRouter();
  const [villas] = useState<VillaListing[]>(() => initialVillas);
  const [guides] = useState<GuidePost[]>(() => initialGuides);
  const [homeSections] = useState<ResolvedHomeSection[]>(
    () => initialHomeSections,
  );
  const [filters, setFilters] = useState<VillaFilters>(() =>
    getDefaultFilters(Math.max(getMaxVillaPrice(initialVillas), 1000)),
  );

  const maxAvailablePrice = useMemo(() => getMaxVillaPrice(villas), [villas]);
  const zones = useMemo(() => getUniqueZones(villas), [villas]);
  const railSections = homeSections.filter((section) => section.villas.length > 0);

  function handleHeroSearch() {
    const shouldOmitPlaceholderPrice =
      maxAvailablePrice <= 1000 && filters.maxPrice <= 1000;
    const params = filtersToSearchParams(
      normalizeFiltersForSearch(filters, maxAvailablePrice),
      { omitMaxPrice: shouldOmitPlaceholderPrice },
    );
    const query = params.toString();

    router.push(query ? `/search?${query}` : "/search");
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--site-surface-soft)] text-[var(--site-text)]">
      <HeroSection
        filters={filters}
        heroImage={settings.heroImage}
        zones={zones}
        maxAvailablePrice={maxAvailablePrice}
        onChange={setFilters}
        onSearch={handleHeroSearch}
      />

      <div>
        {railSections.length > 0 ? (
          railSections.map((section, index) => (
            <Fragment key={section.slug}>
              <VillaRail
                cta={section.cta}
                id={section.slug}
                title={section.title}
                description={section.description}
                villas={section.villas}
              />
              {index === 0 ? <WhyChooseSection /> : null}
            </Fragment>
          ))
        ) : (
          <WhyChooseSection />
        )}

        <DestinationsSection villas={villas} />
        <TikTokSection tiktok={settings.tiktok} />
        <ArticlesSection guides={guides} />
        <FaqSection />
        <ContactSection settings={settings} />
      </div>
    </main>
  );
}
