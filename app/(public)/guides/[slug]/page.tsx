import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  GuideDetailBottomSections,
  GuideDetailBottomSectionsSkeleton,
  GuideDetailPage,
  RecommendedVillaSidebar,
  RecommendedVillaSidebarSkeleton,
} from "@/components/guides/guide-detail-page";
import { serializeJsonLd } from "@/lib/json-ld";
import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildGuideArticleMetadata,
  buildMetadataImageUrl,
  buildSiteSettingsPageMetadata,
} from "@/lib/seo";
import {
  getGuideBySlug,
  getPublishedGuides,
  resolveGuideRecommendedVillas,
} from "@/lib/guides/server";
import { getSiteSettings } from "@/lib/site-settings/server";
import { getSiteContactSettings } from "@/lib/site-contact-settings/server";
import type { GuidePost } from "@/lib/guides/types";
import { fetchHouseListings } from "@/lib/villas/server";
import type { VillaListing } from "@/lib/villas/types";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

async function GuideRecommendedVillasSection({
  guide,
}: {
  guide: GuidePost;
}) {
  let recommendedVillas: VillaListing[] = [];

  try {
    const villas = await fetchHouseListings();
    recommendedVillas = resolveGuideRecommendedVillas(
      guide.recommendedHouseIds,
      villas,
    );
  } catch (error) {
    console.error("Unable to load guide villa recommendations", error);
  }

  return <RecommendedVillaSidebar villas={recommendedVillas} />;
}

async function GuideBottomSections({ guide }: { guide: GuidePost }) {
  const [guidesResult, siteSettingsResult] = await Promise.allSettled([
    getPublishedGuides(),
    getSiteContactSettings(),
  ]);

  let relatedGuides: GuidePost[] = [];

  if (guidesResult.status === "fulfilled") {
    relatedGuides = guidesResult.value.filter(
      (relatedGuide) => relatedGuide.id !== guide.id,
    );
  } else {
    console.error("Unable to load related guides", guidesResult.reason);
  }

  if (siteSettingsResult.status === "rejected") {
    console.error("Unable to load guide contact settings", siteSettingsResult.reason);
  }

  return (
    <GuideDetailBottomSections
      relatedGuides={relatedGuides}
      settings={
        siteSettingsResult.status === "fulfilled"
          ? siteSettingsResult.value.settings
          : undefined
      }
    />
  );
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

  return buildGuideArticleMetadata({ guide, settings });
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

  const guideCoverImageUrl = guide.coverImage?.url
    ? buildMetadataImageUrl(guide.coverImage.url)
    : null;
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
      image: guideCoverImageUrl ? [guideCoverImageUrl] : undefined,
      datePublished: guide.publishedAt ?? guide.createdAt,
      dateModified: guide.updatedAt,
      mainEntityOfPage: absoluteUrl(`/guides/${guide.slug}`),
    },
  ];
  const hasConfiguredRecommendedVillas = guide.recommendedHouseIds.length > 0;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <GuideDetailPage
        bottomSections={
          <Suspense fallback={<GuideDetailBottomSectionsSkeleton />}>
            <GuideBottomSections guide={guide} />
          </Suspense>
        }
        guide={guide}
        recommendedVillas={[]}
        relatedGuides={[]}
        sidebar={
          hasConfiguredRecommendedVillas ? (
            <Suspense fallback={<RecommendedVillaSidebarSkeleton />}>
              <GuideRecommendedVillasSection guide={guide} />
            </Suspense>
          ) : undefined
        }
      />
    </>
  );
}
