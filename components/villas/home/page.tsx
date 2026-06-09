"use client";

import { Fragment, useState } from "react";

import type { GuidePost } from "@/lib/guides/types";
import type { ResolvedHomeSection } from "@/lib/home-sections/types";
import type { SiteSettings } from "@/lib/site-settings/types";
import {
  filtersToSearchParams,
  getDefaultFilters,
  normalizeFiltersForSearch,
} from "@/lib/villas/filters";
import type { VillaFilters } from "@/lib/villas/types";

import { ArticlesSection } from "./articles-section";
import { ContactSection } from "./contact-section";
import { DestinationsSection } from "./destinations-section";
import { FaqSection } from "./faq-section";
import { HeroSection } from "./hero-section";
import { VillaRail } from "./villa-rail";
import { WhyChooseSection } from "./why-choose-section";
import { TikTokSection } from "./tiktok-section";

type FilterSummary = {
  maxAvailablePrice: number;
  zones: Array<{ value: string; label: string }>;
};

type DestinationVilla = {
  coverImage: string | null;
};

export interface HomePageDegradedSources {
  guidePosts: boolean;
  homeSections: boolean;
  siteSettings: boolean;
  villaCatalog: boolean;
}

interface HomePageProps {
  degradedSources?: HomePageDegradedSources;
  initialGuides?: GuidePost[];
  initialHomeSections?: ResolvedHomeSection[];
  filterSummary?: FilterSummary;
  destinationVillas?: DestinationVilla[];
  settings: SiteSettings;
}

/**
 * Render the site's homepage with hero, villa rails, and supporting content sections.
 *
 * Renders a HeroSection (driving search filters), a sequence of VillaRail sections when available
 * (inserting WhyChooseSection after the first rail), and the Destinations, TikTok, Articles,
 * FAQ, and Contact sections.
 *
 * @param initialGuides - Optional initial list of guide articles used to populate the ArticlesSection
 * @param initialHomeSections - Optional initial home sections used to build villa rails
 * @param filterSummary - Optional precomputed filter summary used to initialize hero filter defaults and price/zone controls
 * @param destinationVillas - Optional minimal villa records for destination cards
 * @param settings - Required site settings (visual assets, contact info, default TikTok settings, etc.)
 * @returns The React element tree for the homepage
 */
export function HomePage({
  degradedSources,
  initialGuides = [],
  initialHomeSections = [],
  filterSummary,
  destinationVillas = [],
  settings,
}: HomePageProps) {
  const maxAvailablePrice = filterSummary?.maxAvailablePrice ?? 0;
  const zones = filterSummary?.zones ?? [];
  const [guides] = useState<GuidePost[]>(() => initialGuides);
  const [homeSections] = useState<ResolvedHomeSection[]>(
    () => initialHomeSections,
  );
  const [filters, setFilters] = useState<VillaFilters>(() =>
    getDefaultFilters(Math.max(maxAvailablePrice, 1000)),
  );

  const railSections = homeSections.filter((section) => section.villas.length > 0);

  function handleHeroSearch() {
    const shouldOmitPlaceholderPrice =
      maxAvailablePrice <= 1000 && filters.maxPrice <= 1000;
    const params = filtersToSearchParams(
      normalizeFiltersForSearch(filters, maxAvailablePrice),
      { omitMaxPrice: shouldOmitPlaceholderPrice },
    );
    const query = params.toString();

    window.open(query ? `/search?${query}` : "/search", "_self");
  }

  const degradedSourceNames = [
    degradedSources?.siteSettings ? "siteSettings" : null,
    degradedSources?.guidePosts ? "guidePosts" : null,
    degradedSources?.villaCatalog ? "villaCatalog" : null,
    degradedSources?.homeSections ? "homeSections" : null,
  ].filter((source): source is string => source !== null);

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-[var(--site-surface-soft)] text-[var(--site-text)]"
      data-home-degraded={degradedSourceNames.length > 0 ? "true" : undefined}
      data-home-degraded-sources={
        degradedSourceNames.length > 0 ? degradedSourceNames.join(",") : undefined
      }
    >
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

        <DestinationsSection villas={destinationVillas} />
        <TikTokSection tiktok={settings.tiktok} />
        <ArticlesSection guides={guides} />
        <FaqSection />
        <ContactSection settings={settings} />
      </div>
    </main>
  );
}
