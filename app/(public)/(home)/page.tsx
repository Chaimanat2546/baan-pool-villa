import type { Metadata } from "next";

import {
  HomePage,
  type HomePageDegradedSources,
} from "@/components/villas/home/page";
import { selectHomeGuideSummaries } from "@/components/villas/home/articles-section";
import { toHomePageSettings } from "@/components/villas/home/client-payload";
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

async function getHomePageData(): Promise<{
  degradedSources: Omit<HomePageDegradedSources, "siteSettings">;
  guides: PublicGuideSummary[];
  homeSections: Awaited<ReturnType<typeof getResolvedHomeSections>>["sections"];
  filterSummary: FilterSummary;
  destinationVillas: DestinationVilla[];
}> {
  const [guidesResult, homeSectionHouseIdsResult] = await Promise.allSettled([
    getPublishedGuides(),
    getActiveHomeSectionHouseIds(),
  ]);
  const guides =
    guidesResult.status === "fulfilled" ? guidesResult.value : [];

  if (guidesResult.status === "rejected") {
    console.error("Unable to load homepage guide posts", guidesResult.reason);
  }

  const villasResult = await fetchHomeListings(
    homeSectionHouseIdsResult.status === "fulfilled"
      ? homeSectionHouseIdsResult.value
      : [],
  ).then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ reason, status: "rejected" as const }),
  );

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
  const [settingsResult, homePageData] = await Promise.all([
    getSiteSettings(),
    getHomePageData(),
  ]);
  const { settings } = settingsResult;

  const jsonLd = buildHomeJsonLd(settings);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <HomePage
        initialGuides={homePageData.guides}
        initialHomeSections={homePageData.homeSections}
        filterSummary={homePageData.filterSummary}
        destinationVillas={homePageData.destinationVillas}
        degradedSources={{
          ...homePageData.degradedSources,
          siteSettings: settingsResult.degraded,
        }}
        settings={toHomePageSettings(settings)}
      />
    </>
  );
}
