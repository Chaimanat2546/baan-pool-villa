import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GuideDetailPage } from "@/components/guides/guide-detail-page";
import { serializeJsonLd } from "@/lib/json-ld";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";
import {
  getGuideBySlug,
  resolveGuideRecommendedVillas,
} from "@/lib/guides/server";
import { fetchHouseListings } from "@/lib/villas/server";
import type { VillaListing } from "@/lib/villas/types";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);

  if (!guide) {
    return buildPageMetadata({
      canonicalPath: `/guides/${slug}`,
      description: "ไม่พบบทความที่คุณกำลังค้นหา",
      title: "ไม่พบบทความ",
    });
  }

  return buildPageMetadata({
    canonicalPath: `/guides/${guide.slug}`,
    description: guide.excerpt,
    image: guide.coverImage?.url,
    imageAlt: guide.coverImage?.alt,
    title: guide.title,
  });
}

export default async function GuideDetailRoute({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);

  if (!guide) {
    notFound();
  }

  let recommendedVillas: VillaListing[] = [];

  try {
    const villas = await fetchHouseListings();
    recommendedVillas = resolveGuideRecommendedVillas(
      guide.recommendedHouseIds,
      villas,
    );
  } catch (error) {
    console.error("Unable to load guide recommended villas", error);
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.excerpt,
    image: guide.coverImage?.url ? [guide.coverImage.url] : undefined,
    datePublished: guide.publishedAt ?? guide.createdAt,
    dateModified: guide.updatedAt,
    mainEntityOfPage: absoluteUrl(`/guides/${guide.slug}`),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <GuideDetailPage guide={guide} recommendedVillas={recommendedVillas} />
    </>
  );
}
