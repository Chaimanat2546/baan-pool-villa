import type { Metadata } from "next";

import { HomePage } from "@/components/villas/home/page";
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
  guides: GuidePost[];
  homeSections: Awaited<ReturnType<typeof getResolvedHomeSections>>["sections"];
  filterSummary: FilterSummary;
  destinationVillas: DestinationVilla[];
}> {
  try {
    const [guides, villas] = await Promise.all([
      getPublishedGuides(),
      fetchHouseListings(),
    ]);
    const { sections } = await getResolvedHomeSections(villas);

    return {
      guides,
      homeSections: sections,
      filterSummary: {
        maxAvailablePrice: getMaxVillaPrice(villas),
        zones: getUniqueZones(villas),
      },
      destinationVillas: villas.slice(0, 12).map((villa) => ({
        coverImage: villa.coverImage,
      })),
    };
  } catch (error) {
    console.error("Unable to load homepage villa data", error);

    return {
      guides: [],
      homeSections: [],
      filterSummary: {
        maxAvailablePrice: 0,
        zones: [],
      },
      destinationVillas: [],
    };
  }
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
  const [{ settings }, homePageData] = await Promise.all([
    getSiteSettings(),
    getHomePageData(),
  ]);
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
        settings={settings}
      />
    </>
  );
}
