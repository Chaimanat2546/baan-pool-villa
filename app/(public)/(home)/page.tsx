import type { Metadata } from "next";

import { HomePage } from "@/components/villas/home/page";
import { getPublishedGuides } from "@/lib/guides/server";
import type { GuidePost } from "@/lib/guides/types";
import { getResolvedHomeSections } from "@/lib/home-sections/server";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildHomeJsonLd, buildPageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings/server";
import { fetchHouseListings } from "@/lib/villas/server";
import type { VillaListing } from "@/lib/villas/types";

async function getHomePageData(): Promise<{
  guides: GuidePost[];
  homeSections: Awaited<ReturnType<typeof getResolvedHomeSections>>["sections"];
  villas: VillaListing[];
}> {
  try {
    const [guides, villas] = await Promise.all([
      getPublishedGuides(),
      fetchHouseListings(),
    ]);
    const { sections } = await getResolvedHomeSections(villas);

    return { guides, homeSections: sections, villas };
  } catch (error) {
    console.error("Unable to load homepage villa data", error);

    return { guides: [], homeSections: [], villas: [] };
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

export default async function Page() {
  const [{ settings }, { guides, homeSections, villas }] = await Promise.all([
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
        initialGuides={guides}
        initialHomeSections={homeSections}
        initialVillas={villas}
        settings={settings}
      />
    </>
  );
}
