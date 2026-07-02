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
import { getPublishedGuides } from "@/lib/guides/server";
import type { PublicGuideSummary } from "@/lib/guides/public-dto";
import {
  getActiveHomeSectionHouseIds,
  getResolvedHomeSections,
} from "@/lib/home-sections/server";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildHomeJsonLd, buildSiteSettingsPageMetadata } from "@/lib/seo";
import { getMaxVillaPrice, getUniqueZones } from "@/lib/villas/filters";
import { getSiteSettings } from "@/lib/site-settings/server";
import { fetchHomeListings } from "@/lib/villas/server";
import { toPublicVillaListing } from "@/lib/villas/public-dto";

type FilterSummary = {
  maxAvailablePrice: number;
  zones: Array<{ value: string; label: string }>;
};

type DestinationVilla = {
  coverImage: string | null;
  id: string;
};

type HomePageData = {
  degradedSources: Omit<HomePageDegradedSources, "siteSettings">;
  guides: PublicGuideSummary[];
  homeSections: Awaited<ReturnType<typeof getResolvedHomeSections>>["sections"];
  filterSummary: FilterSummary;
  destinationVillas: DestinationVilla[];
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
}: {
  homePageDataPromise: Promise<HomePageData>;
  settings: HomePageSettings;
}) {
  const homePageData = await homePageDataPromise;

  return (
    <>
      <HomeDeferredDegradedMarker
        degradedSources={homePageData.degradedSources}
      />
      <HomePageContent
        initialGuides={homePageData.guides}
        initialHomeSections={homePageData.homeSections}
        destinationVillas={homePageData.destinationVillas}
        settings={settings}
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
  const guidesResultPromise = getPublishedGuides().then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ reason, status: "rejected" as const }),
  );
  const homeSectionHouseIdsResult = await getActiveHomeSectionHouseIds().then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ reason, status: "rejected" as const }),
  );

  const villasResult = await fetchHomeListings(
    homeSectionHouseIdsResult.status === "fulfilled"
      ? homeSectionHouseIdsResult.value
      : [],
  ).then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ reason, status: "rejected" as const }),
  );
  const guidesResult = await guidesResultPromise;
  const guides =
    guidesResult.status === "fulfilled" ? guidesResult.value : [];

  if (guidesResult.status === "rejected") {
    console.error("Unable to load homepage guide posts", guidesResult.reason);
  }

  if (villasResult.status === "rejected") {
    console.error("Unable to load homepage villa data", villasResult.reason);

    return {
      degradedSources: {
        guidePosts: guidesResult.status === "rejected",
        homeSections: false,
        villaCatalog: true,
      },
      guides: selectHomeGuideSummaries(guides),
      homeSections: [],
      filterSummary: {
        maxAvailablePrice: 0,
        zones: [],
      },
      destinationVillas: [],
    };
  }

  const villas = villasResult.value;
  const homeSectionsResult = await getResolvedHomeSections(villas);

  if (homeSectionsResult.degraded) {
    console.error(
      "Homepage rendered with fallback home sections",
      homeSectionsResult.fallbackReason,
    );
  }

  return {
    degradedSources: {
      guidePosts: guidesResult.status === "rejected",
      homeSections: homeSectionsResult.degraded,
      villaCatalog: false,
    },
    guides: selectHomeGuideSummaries(guides),
    homeSections: homeSectionsResult.sections.map((section) => ({
      ...section,
      villas: section.villas.map(toPublicVillaListing),
    })),
    filterSummary: {
      maxAvailablePrice: getMaxVillaPrice(villas),
      zones: getUniqueZones(villas),
    },
    destinationVillas: villas.slice(0, 12).map((villa) => {
      const publicVilla = toPublicVillaListing(villa);

      return {
        coverImage: publicVilla.coverImage,
        id: publicVilla.id,
      };
    }),
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
 * Loads site settings and homepage data, builds JSON-LD for the site, injects the JSON-LD script into the page, and renders the HomePage component with resolved sections, filter summary, and destination villa payload.
 *
 * @returns A React element for the homepage containing the injected JSON-LD script and the HomePage component initialized with fetched data and settings.
 */
export default async function Page() {
  const homePageDataPromise = getHomePageData();
  const settingsResult = await getSiteSettings();
  const { settings } = settingsResult;
  const homePageSettings = toHomePageSettings(settings);

  const jsonLd = buildHomeJsonLd(settings);

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
          siteSettings: settingsResult.degraded,
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
          />
        </Suspense>
      </HomePage>
    </>
  );
}
