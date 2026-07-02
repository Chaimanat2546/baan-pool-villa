import { Fragment, type ReactNode } from "react";

import { ContactSection } from "@/components/layout/contact-section";
import type { PublicAdvertisement } from "@/lib/advertisements/types";
import type { HomePageSettings } from "@/components/villas/home/client-payload";
import type { PublicGuideSummary } from "@/lib/guides/public-dto";
import type { ResolvedHomeSection } from "@/lib/home-sections/types";
import { SEARCH_FACETS } from "@/lib/villas/search-options";

import { ActivitiesSection } from "./activities-section";
import { ArticlesSection } from "./articles-section";
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
  id: string;
};

export interface HomePageDegradedSources {
  advertisements: boolean;
  guidePosts: boolean;
  homeSections: boolean;
  siteSettings: boolean;
  villaCatalog: boolean;
}

interface HomePageProps {
  children?: ReactNode;
  degradedSources?: HomePageDegradedSources;
  heroSearch?: ReactNode;
  initialAdvertisements?: PublicAdvertisement[];
  initialGuides?: PublicGuideSummary[];
  initialHomeSections?: ResolvedHomeSection[];
  filterSummary?: FilterSummary;
  destinationVillas?: DestinationVilla[];
  settings: HomePageSettings;
}

interface HomePageContentProps {
  destinationVillas?: DestinationVilla[];
  initialAdvertisements?: PublicAdvertisement[];
  initialGuides?: PublicGuideSummary[];
  initialHomeSections?: ResolvedHomeSection[];
  settings: HomePageSettings;
}

export function HomePageContent({
  initialAdvertisements = [],
  destinationVillas = [],
  initialGuides = [],
  initialHomeSections = [],
  settings,
}: HomePageContentProps) {
  const railSections = initialHomeSections.filter(
    (section) => section.villas.length > 0,
  );

  return (
    <>
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
      <ActivitiesSection advertisements={initialAdvertisements} />
      <ArticlesSection guides={initialGuides} />
      <FaqSection />
      <ContactSection settings={settings} />
    </>
  );
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
  children,
  degradedSources,
  heroSearch,
  initialAdvertisements = [],
  initialGuides = [],
  initialHomeSections = [],
  filterSummary,
  destinationVillas = [],
  settings,
}: HomePageProps) {
  const maxAvailablePrice = filterSummary?.maxAvailablePrice ?? SEARCH_FACETS.maxPrice;
  const zones = filterSummary?.zones ?? SEARCH_FACETS.zones;

  const degradedSourceNames = [
    degradedSources?.siteSettings ? "siteSettings" : null,
    degradedSources?.advertisements ? "advertisements" : null,
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
        heroImage={settings.heroImage}
        zones={zones}
        maxAvailablePrice={maxAvailablePrice}
        search={heroSearch}
      />

      <div>
        {children ?? (
          <HomePageContent
            destinationVillas={destinationVillas}
            initialAdvertisements={initialAdvertisements}
            initialGuides={initialGuides}
            initialHomeSections={initialHomeSections}
            settings={settings}
          />
        )}
      </div>
    </main>
  );
}
