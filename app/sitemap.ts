import type { MetadataRoute } from "next";
import type { SitemapRevalidateSeconds } from "@/lib/cache-policy";

import { getPublishedGuidesForSitemap } from "@/lib/guides/server";
import { getPublishedLegalPagesForSitemap } from "@/lib/legal-pages/server";
import { absoluteUrl, buildMetadataImageUrl } from "@/lib/seo";
import { fetchHouseListingsForSitemap } from "@/lib/villas/server";

// Cache crawler reads at the route level; underlying data helpers still use tagged caches.
// Next.js requires route segment revalidate values to be statically analyzable literals.
export const revalidate: SitemapRevalidateSeconds = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      changeFrequency: "daily",
      priority: 1,
      url: absoluteUrl("/"),
    },
    {
      changeFrequency: "daily",
      priority: 0.9,
      url: absoluteUrl("/search"),
    },
    {
      changeFrequency: "weekly",
      priority: 0.7,
      url: absoluteUrl("/guides"),
    },
  ];

  const [listings, guidesResult, legalPagesResult] = await Promise.all([
    fetchHouseListingsForSitemap(),
    getPublishedGuidesForSitemap().catch((error: unknown) => {
      console.error("Unable to load guide routes for sitemap", error);

      return [];
    }),
    getPublishedLegalPagesForSitemap().catch((error: unknown) => {
      console.error("Unable to load legal page routes for sitemap", error);

      return [];
    }),
  ]);

  const villaRoutes: MetadataRoute.Sitemap = listings.map((listing) => {
    const coverImageUrl = listing.coverImage
      ? buildMetadataImageUrl(listing.coverImage)
      : null;

    return {
      changeFrequency: "daily" as const,
      images: coverImageUrl ? [coverImageUrl] : undefined,
      priority: 0.8,
      url: absoluteUrl(`/villas/${listing.id}`),
    };
  });

  const guideRoutes: MetadataRoute.Sitemap = guidesResult.map((guide) => {
    const coverImageUrl = guide.coverImage?.url
      ? buildMetadataImageUrl(guide.coverImage.url)
      : null;

    return {
      changeFrequency: "weekly" as const,
      images: coverImageUrl ? [coverImageUrl] : undefined,
      lastModified: guide.updatedAt ? new Date(guide.updatedAt) : undefined,
      priority: guide.isPinned ? 0.75 : 0.65,
      url: absoluteUrl(`/guides/${guide.slug}`),
    };
  });

  const legalRoutes: MetadataRoute.Sitemap = legalPagesResult.map((page) => ({
    changeFrequency: "monthly" as const,
    lastModified: page.updatedAt ? new Date(page.updatedAt) : undefined,
    priority: 0.45,
    url: absoluteUrl(`/${page.slug}`),
  }));

  return [...staticRoutes, ...villaRoutes, ...guideRoutes, ...legalRoutes];
}
