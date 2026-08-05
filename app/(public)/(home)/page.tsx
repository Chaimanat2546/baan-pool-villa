import type { Metadata } from "next";
import { Suspense } from "react";

import {
  HomePage,
  HomePageContent,
  type HomePageDegradedSources,
} from "@/components/villas/home/page";
import { AdminRecoveryHashRedirect } from "@/components/admin/login/admin-recovery-hash-redirect";
import { selectHomeGuideSummaries } from "@/components/villas/home/articles-section";
import {
  toHomePageSettings,
  type HomePageSettings,
} from "@/components/villas/home/client-payload";
import { HeroSearchSkeleton } from "@/components/villas/home/hero-section-skeleton";
import { HeroSearch } from "@/components/villas/home/hero-search";
import { VillaRailSkeleton } from "@/components/villas/home/villa-rail-skeleton";
import { getHomepageCustomerReviewData } from "@/lib/customer-reviews/server";
import {
  DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT,
  type HomepageCustomerReviewData,
} from "@/lib/customer-reviews/types";
import { getPublishedGuides } from "@/lib/guides/server";
import type { PublicGuideSummary } from "@/lib/guides/public-dto";
import {
  getHomeSectionListingPlan,
  getResolvedHomeSections,
} from "@/lib/home-sections/server";
import { buildDefaultHomePageLayout } from "@/lib/home-sections/layout";
import type { HomePageLayoutResult } from "@/lib/home-sections/types";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildHomeJsonLd, buildSiteSettingsPageMetadata } from "@/lib/seo";
import { SEARCH_FACETS } from "@/lib/villas/search-options";
import { getSiteSettings } from "@/lib/site-settings/server";
import { getSiteContactSettings } from "@/lib/site-contact-settings/server";
import { getSiteWebStyles } from "@/lib/site-web-styles/server";
import {
  fetchActiveVillaZones,
  fetchHomeListings,
} from "@/lib/villas/server";
import { toPublicVillaListing } from "@/lib/villas/public-dto";

type FilterSummary = {
  maxAvailablePrice: number;
  zones: Array<{ value: string; label: string }>;
};

const HOME_FALLBACK_LISTING_LIMIT = 12;

type HomePageData = {
  degradedSources: Omit<HomePageDegradedSources, "siteSettings">;
  customerReviews: HomepageCustomerReviewData;
  guides: PublicGuideSummary[];
  homeLayout: HomePageLayoutResult;
  homeSections: Awaited<ReturnType<typeof getResolvedHomeSections>>["sections"];
  filterSummary: FilterSummary;
};

function HomeDeferredContentSkeleton() {
  return (
    <div className="pt-0 lg:pt-20">
      <VillaRailSkeleton />
      <VillaRailSkeleton cardCount={4} withCta={false} />
    </div>
  );
}

function HomeDeferredDegradedMarker({
  degradedSources,
}: {
  degradedSources: Omit<HomePageDegradedSources, "siteSettings">;
}) {
  const degradedSourceNames = [
    degradedSources.guidePosts ? "guidePosts" : null,
    degradedSources.villaCatalog ? "villaCatalog" : null,
    degradedSources.homeSections ? "homeSections" : null,
  ].filter((source): source is string => source !== null);

  if (degradedSourceNames.length === 0) {
    return null;
  }

  return (
    <span
      hidden
      data-home-deferred-degraded="true"
      data-home-deferred-degraded-sources={degradedSourceNames.join(",")}
    />
  );
}

async function HomeDeferredContent({
  homePageDataPromise,
  settings,
  villaCardStyle,
}: {
  homePageDataPromise: Promise<HomePageData>;
  settings: HomePageSettings;
  villaCardStyle: Awaited<ReturnType<typeof getSiteWebStyles>>["houseCard"]["variant"];
}) {
  const homePageData = await homePageDataPromise;

  return (
    <>
      <HomeDeferredDegradedMarker
        degradedSources={homePageData.degradedSources}
      />
      <HomePageContent
        customerReviews={homePageData.customerReviews}
        initialGuides={homePageData.guides}
        initialHomeSections={homePageData.homeSections}
        homeLayout={homePageData.homeLayout.items}
        settings={settings}
        villaCardStyle={villaCardStyle}
      />
    </>
  );
}

async function HomeHeroSearch({
  homePageDataPromise,
}: {
  homePageDataPromise: Promise<HomePageData>;
}) {
  const homePageData = await homePageDataPromise;

  return (
    <HeroSearch
      maxAvailablePrice={homePageData.filterSummary.maxAvailablePrice}
      zones={homePageData.filterSummary.zones}
    />
  );
}

async function getHomePageData(): Promise<HomePageData> {
  const zonesResultPromise = fetchActiveVillaZones().then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ reason, status: "rejected" as const }),
  );
  const guidesResultPromise = getPublishedGuides().then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ reason, status: "rejected" as const }),
  );
  const customerReviewsResultPromise = getHomepageCustomerReviewData().then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ reason, status: "rejected" as const }),
  );
  const homeSectionListingPlanResult = await getHomeSectionListingPlan(
    HOME_FALLBACK_LISTING_LIMIT,
  ).then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ reason, status: "rejected" as const }),
  );

  const [villasResult, zonesResult] = await Promise.all([
    fetchHomeListings(
      homeSectionListingPlanResult.status === "fulfilled"
        ? homeSectionListingPlanResult.value.houseIds
        : [],
      homeSectionListingPlanResult.status === "fulfilled"
        ? homeSectionListingPlanResult.value.listingLimit
        : HOME_FALLBACK_LISTING_LIMIT,
    ).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason) => ({ reason, status: "rejected" as const }),
    ),
    zonesResultPromise,
  ]);
  const guidesResult = await guidesResultPromise;
  const customerReviewsResult = await customerReviewsResultPromise;
  const guides =
    guidesResult.status === "fulfilled" ? guidesResult.value : [];
  const customerReviews =
    customerReviewsResult.status === "fulfilled"
      ? customerReviewsResult.value
      : {
          images: [],
          layout: DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT,
        };

  if (guidesResult.status === "rejected") {
    console.error("Unable to load homepage guide posts", guidesResult.reason);
  }

  if (zonesResult.status === "rejected") {
    console.error("Unable to load homepage villa zones", zonesResult.reason);
  }

  if (villasResult.status === "rejected") {
    console.error("Unable to load homepage villa data", villasResult.reason);

    return {
      degradedSources: {
        guidePosts: guidesResult.status === "rejected",
        homeSections:
          homeSectionListingPlanResult.status === "rejected" ||
          homeSectionListingPlanResult.value.layout.degraded,
        villaCatalog: true,
      },
      customerReviews,
      guides: selectHomeGuideSummaries(guides),
      homeLayout:
        homeSectionListingPlanResult.status === "fulfilled"
          ? homeSectionListingPlanResult.value.layout
          : {
              degraded: true,
              items: buildDefaultHomePageLayout([]),
              source: "fallback",
            },
      homeSections: [],
      filterSummary: {
        maxAvailablePrice: SEARCH_FACETS.maxPrice,
        zones: zonesResult.status === "fulfilled" ? zonesResult.value : [],
      },
    };
  }

  const villas = villasResult.value;
  const homeSectionsResult =
    homeSectionListingPlanResult.status === "fulfilled"
      ? await getResolvedHomeSections(
          villas,
          homeSectionListingPlanResult.value.configs,
          homeSectionListingPlanResult.value.layout.source === "fallback",
        )
      : await getResolvedHomeSections(villas);
  const homeLayout =
    homeSectionListingPlanResult.status === "fulfilled"
      ? homeSectionListingPlanResult.value.layout
      : {
          degraded: true as const,
          items: buildDefaultHomePageLayout(
            homeSectionsResult.sections.map(({ slug }) => slug),
          ),
          source: "fallback" as const,
        };

  if (homeSectionsResult.degraded) {
    console.error(
      "Homepage rendered with fallback home sections",
      homeSectionsResult.fallbackReason,
    );
  }

  return {
    degradedSources: {
      guidePosts: guidesResult.status === "rejected",
      homeSections: homeSectionsResult.degraded || homeLayout.degraded,
      villaCatalog: zonesResult.status === "rejected",
    },
    customerReviews,
    guides: selectHomeGuideSummaries(guides),
    homeLayout,
    homeSections: homeSectionsResult.sections.map((section) => ({
      ...section,
      villas: section.villas.map(toPublicVillaListing),
    })),
    filterSummary: {
      maxAvailablePrice: SEARCH_FACETS.maxPrice,
      zones: zonesResult.status === "fulfilled" ? zonesResult.value : [],
    },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSiteSettings();

  return buildSiteSettingsPageMetadata({
    absoluteTitle: true,
    canonicalPath: "/",
    settings,
    title: settings.seo.title,
  });
}

/**
 * Render the homepage server component populated with site settings, guides, home sections, filter summary, and JSON-LD.
 *
 * Loads site settings and homepage data, builds JSON-LD for the site, injects the JSON-LD script into the page, and renders the HomePage component with resolved sections and filter summary.
 *
 * @returns A React element for the homepage containing the injected JSON-LD script and the HomePage component initialized with fetched data and settings.
 */
export default async function Page() {
  const homePageDataPromise = getHomePageData();
  const [settingsResult, contactSettingsResult, siteWebStyles] = await Promise.all([
    getSiteSettings(),
    getSiteContactSettings(),
    getSiteWebStyles(),
  ]);
  const { settings } = settingsResult;
  const homePageSettings = toHomePageSettings(
    settings,
    contactSettingsResult.settings,
  );

  const jsonLd = buildHomeJsonLd(settings, contactSettingsResult.settings);

  return (
    <>
      <AdminRecoveryHashRedirect />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <HomePage
        degradedSources={{
          guidePosts: false,
          homeSections: false,
          siteSettings: settingsResult.degraded || contactSettingsResult.degraded,
          villaCatalog: false,
        }}
        heroSearch={
          <Suspense fallback={<HeroSearchSkeleton />}>
            <HomeHeroSearch homePageDataPromise={homePageDataPromise} />
          </Suspense>
        }
        settings={homePageSettings}
      >
        <Suspense fallback={<HomeDeferredContentSkeleton />}>
          <HomeDeferredContent
            homePageDataPromise={homePageDataPromise}
            settings={homePageSettings}
            villaCardStyle={siteWebStyles.houseCard.variant}
          />
        </Suspense>
      </HomePage>
    </>
  );
}
