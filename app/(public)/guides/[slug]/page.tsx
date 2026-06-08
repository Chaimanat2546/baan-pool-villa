import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GuideDetailPage } from "@/components/guides/guide-detail-page";
import { serializeJsonLd } from "@/lib/json-ld";
import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildSiteSettingsPageMetadata,
} from "@/lib/seo";
import {
  getGuideBySlug,
  getPublishedGuides,
  resolveGuideRecommendedVillas,
} from "@/lib/guides/server";
import { getSiteSettings } from "@/lib/site-settings/server";
import type { GuidePost } from "@/lib/guides/types";
import { fetchHouseListings } from "@/lib/villas/server";
import type { VillaListing } from "@/lib/villas/types";

export const revalidate = 43200;

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  let guides: GuidePost[] = [];

  try {
    guides = await getPublishedGuides();
  } catch (error) {
    console.error("Unable to prebuild guide detail pages", error);
  }

  return guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const [guide, siteSettingsResult] = await Promise.all([
    getGuideBySlug(slug),
    getSiteSettings(),
  ]);
  const { settings } = siteSettingsResult;

  if (!guide) {
    return buildSiteSettingsPageMetadata({
      canonicalPath: `/guides/${slug}`,
      description: "ไม่พบบทความที่คุณกำลังค้นหา",
      settings,
      title: "ไม่พบบทความ",
    });
  }

  return buildSiteSettingsPageMetadata({
    canonicalPath: `/guides/${guide.slug}`,
    description: guide.excerpt,
    image: guide.coverImage?.url,
    imageAlt: guide.coverImage?.alt,
    settings,
    title: guide.title,
  });
}

/**
 * Render the guide detail route for a given guide slug, injecting JSON-LD and loading recommendations.
 *
 * Resolves the route params to fetch the guide by slug, returns a 404 via `notFound()` when no guide exists,
 * concurrently loads house listings and published guides to compute recommended villas and related guides,
 * and renders the page along with an Article JSON-LD script.
 *
 * @param params - A promise that resolves to an object containing the route `slug`
 * @returns The JSX for the guide detail page and its JSON-LD script element
 */
export default async function GuideDetailRoute({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);

  if (!guide) {
    notFound();
  }

  let recommendedVillas: VillaListing[] = [];
  let relatedGuides: GuidePost[] = [];

  const [villasResult, guidesResult] = await Promise.allSettled([
    fetchHouseListings(),
    getPublishedGuides(),
  ]);

  if (villasResult.status === "fulfilled") {
    recommendedVillas = resolveGuideRecommendedVillas(
      guide.recommendedHouseIds,
      villasResult.value,
    );
  } else {
    console.error("Unable to load guide villa recommendations", villasResult.reason);
  }

  if (guidesResult.status === "fulfilled") {
    relatedGuides = guidesResult.value.filter(
      (relatedGuide) => relatedGuide.id !== guide.id,
    );
  } else {
    console.error("Unable to load related guides", guidesResult.reason);
  }

  const jsonLd = [
    buildBreadcrumbJsonLd([
      { name: "หน้าแรก", path: "/" },
      { name: "บทความ", path: "/guides" },
      { name: guide.title, path: `/guides/${guide.slug}` },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.title,
      description: guide.excerpt,
      image: guide.coverImage?.url ? [guide.coverImage.url] : undefined,
      datePublished: guide.publishedAt ?? guide.createdAt,
      dateModified: guide.updatedAt,
      mainEntityOfPage: absoluteUrl(`/guides/${guide.slug}`),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <GuideDetailPage
        guide={guide}
        recommendedVillas={recommendedVillas}
        relatedGuides={relatedGuides}
      />
    </>
  );
}
