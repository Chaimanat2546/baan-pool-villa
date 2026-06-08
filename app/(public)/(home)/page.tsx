import type { Metadata } from "next";

import {
  HomePage,
  type HomePageDegradedSources,
} from "@/components/villas/home/page";
import { getPublishedGuides } from "@/lib/guides/server";
import type { GuidePost } from "@/lib/guides/types";
import { getResolvedHomeSections } from "@/lib/home-sections/server";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildHomeJsonLd, buildPageMetadata } from "@/lib/seo";
import { getMaxVillaPrice, getUniqueZones } from "@/lib/villas/filters";
import { getSiteSettings } from "@/lib/site-settings/server";
import { fetchHouseListings } from "@/lib/villas/server";

export const revalidate = 43200;

type FilterSummary = {
  maxAvailablePrice: number;
  zones: Array<{ value: string; label: string }>;
};

type DestinationVilla = {
  coverImage: string | null;
};

async function getHomePageData(): Promise<{
  degradedSources: Omit<HomePageDegradedSources, "siteSettings">;
  guides: GuidePost[];
  homeSections: Awaited<ReturnType<typeof getResolvedHomeSections>>["sections"];
  filterSummary: FilterSummary;
  destinationVillas: DestinationVilla[];
}> {
  const [guidesResult, villasResult] = await Promise.allSettled([
    getPublishedGuides(),
    fetchHouseListings(),
  ]);
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
      guides,
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
    guides,
    homeSections: homeSectionsResult.sections,
    filterSummary: {
      maxAvailablePrice: getMaxVillaPrice(villas),
      zones: getUniqueZones(villas),
    },
    destinationVillas: villas.slice(0, 12).map((villa) => ({
      coverImage: villa.coverImage,
    })),
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSiteSettings();

  return buildPageMetadata({
    canonicalPath: "/",
    description: settings.seo.description,
    image: settings.seo.ogImage.url,
    imageAlt: settings.seo.ogImage.alt,
    siteName: settings.seo.businessName,
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

  if (settingsResult.degraded) {
    console.error("Homepage rendered with fallback site settings");
  }

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
        settings={settings}
      />
    </>
  );
}
