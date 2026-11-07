import { ContactSection } from "@/components/layout/contact-section";
import { NearViewportActivation } from "@/components/ui/near-viewport-activation";
import type { HomePageSettings } from "@/components/villas/home/client-payload";
import {
  DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT,
  type HomepageCustomerReviewData,
} from "@/lib/customer-reviews/types";
import type { PublicGuideSummary } from "@/lib/guides/public-dto";
import {
  buildDefaultHomePageLayout,
  getLeadingHomeRailKey,
} from "@/lib/home-sections/layout";
import type {
  HomePageLayoutItem,
  ResolvedHomeSection,
} from "@/lib/home-sections/types";
import type { SiteVillaCardStyle } from "@/lib/site-web-styles/types";
import { SEARCH_FACETS } from "@/lib/villas/search-options";

import { ArticlesSection } from "./articles-section";
import { CustomerReviewSection } from "./customer-review-section";
import { FaqSection } from "./faq-section";
import { HeroSection } from "./hero-section";
import { VillaRail } from "./villa-rail";
import { WhyChooseSection } from "./why-choose-section";
import { TikTokSection } from "./tiktok-section";

type FilterSummary = {
  maxAvailablePrice: number;
  zones: Array<{ value: string; label: string }>;
};

export interface HomePageDegradedSources {
  guidePosts: boolean;
  homeSections: boolean;
  siteSettings: boolean;
  villaCatalog: boolean;
}

interface HomePageProps {
  customerReviews?: HomepageCustomerReviewData;
  degradedSources?: HomePageDegradedSources;
  initialGuides?: PublicGuideSummary[];
  initialHomeSections?: ResolvedHomeSection[];
  filterSummary?: FilterSummary;
  homeLayout?: HomePageLayoutItem[];
  settings: HomePageSettings;
  villaCardStyle?: SiteVillaCardStyle;
}

type HomePageContentSettings = Pick<
  HomePageSettings,
  "bank" | "contact" | "siteName" | "tiktok"
>;

interface HomePageContentProps {
  customerReviews?: HomepageCustomerReviewData;
  initialGuides?: PublicGuideSummary[];
  initialHomeSections?: ResolvedHomeSection[];
  homeLayout?: HomePageLayoutItem[];
  settings: HomePageContentSettings;
  villaCardStyle?: SiteVillaCardStyle;
}

export function HomePageContent({
  customerReviews = {
    images: [],
    layout: DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT,
  },
  initialGuides = [],
  initialHomeSections = [],
  homeLayout,
  settings,
  villaCardStyle,
}: HomePageContentProps) {
  const railsBySlug = new Map(
    initialHomeSections
      .filter((section) => section.villas.length > 0)
      .map((section) => [section.slug, section]),
  );
  const layout =
    homeLayout ?? buildDefaultHomePageLayout([...railsBySlug.keys()]);
  const leadingRailKey = getLeadingHomeRailKey(
    layout,
    (key) => railsBySlug.has(key),
  );

  return (
    <>
      {layout.map((item) => {
        if (!item.enabled) return null;

        if (item.kind === "rail") {
          const section = railsBySlug.get(item.key);
          if (!section) return null;

          const rail = (
            <VillaRail
              key={`rail:${item.key}`}
              cta={section.cta}
              autoScrollEnabled={section.autoScrollEnabled}
              id={section.slug}
              title={section.title}
              description={section.description}
              villaCardStyle={villaCardStyle}
              villas={section.villas}
            />
          );

          if (item.key === leadingRailKey) {
            return rail;
          }

          return (
            <NearViewportActivation
              initiallyActive={false}
              key={`rail:${item.key}`}
              rootMargin="200px"
            >
              {rail}
            </NearViewportActivation>
          );
        }

        switch (item.key) {
          case "why_choose":
            return <WhyChooseSection key={item.key} siteName={settings.siteName} />;
          case "tiktok":
            return (
              <NearViewportActivation initiallyActive={false} key={item.key} rootMargin="200px">
                <TikTokSection tiktok={settings.tiktok} />
              </NearViewportActivation>
            );
          case "customer_reviews":
            return (
              <NearViewportActivation initiallyActive={false} key={item.key} rootMargin="200px">
                <CustomerReviewSection data={customerReviews} />
              </NearViewportActivation>
            );
          case "articles":
            return (
              <NearViewportActivation initiallyActive={false} key={item.key} rootMargin="200px">
                <ArticlesSection guides={initialGuides} />
              </NearViewportActivation>
            );
          case "faq":
            return <FaqSection key={item.key} />;
          case "contact":
            return <ContactSection key={item.key} settings={settings} />;
        }
      })}
    </>
  );
}

/**
 * Render the site's homepage with hero, villa rails, and supporting content sections.
 *
 * Renders a HeroSection (driving search filters), then renders enabled villa
 * rails and fixed supporting sections in the supplied homepage layout order.
 *
 * @param initialGuides - Optional initial list of guide articles used to populate the ArticlesSection
 * @param initialHomeSections - Optional initial home sections used to build villa rails
 * @param filterSummary - Optional precomputed filter summary used to initialize hero filter defaults and price/zone controls
 * @param settings - Required site settings (visual assets, contact info, default TikTok settings, etc.)
 * @returns The React element tree for the homepage
 */
export function HomePage({
  customerReviews = {
    images: [],
    layout: DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT,
  },
  degradedSources,
  initialGuides = [],
  initialHomeSections = [],
  homeLayout,
  filterSummary,
  settings,
  villaCardStyle,
}: HomePageProps) {
  const maxAvailablePrice = filterSummary?.maxAvailablePrice ?? SEARCH_FACETS.maxPrice;
  const zones = filterSummary?.zones ?? SEARCH_FACETS.zones;

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
        heroImage={settings.heroImage}
        heroSlides={settings.heroSlides}
        zones={zones}
        maxAvailablePrice={maxAvailablePrice}
      />

      <div>
        <HomePageContent
          customerReviews={customerReviews}
          initialGuides={initialGuides}
          initialHomeSections={initialHomeSections}
          homeLayout={homeLayout}
          settings={settings}
          villaCardStyle={villaCardStyle}
        />
      </div>
    </main>
  );
}
