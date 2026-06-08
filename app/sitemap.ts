import type { MetadataRoute } from "next";

import { getPublishedGuides } from "@/lib/guides/server";
import { absoluteUrl } from "@/lib/seo";
import { fetchHouseListings } from "@/lib/villas/server";

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

  const [listings, guides] = await Promise.all([
    fetchHouseListings(),
    getPublishedGuides(),
  ]);

  const villaRoutes: MetadataRoute.Sitemap = listings.map((listing) => ({
    changeFrequency: "daily" as const,
    images: listing.coverImage ? [listing.coverImage] : undefined,
    priority: 0.8,
    url: absoluteUrl(`/villas/${listing.id}`),
  }));

  const guideRoutes: MetadataRoute.Sitemap = guides.map((guide) => ({
    changeFrequency: "weekly" as const,
    images: guide.coverImage?.url ? [guide.coverImage.url] : undefined,
    lastModified: guide.updatedAt ? new Date(guide.updatedAt) : undefined,
    priority: guide.isPinned ? 0.75 : 0.65,
    url: absoluteUrl(`/guides/${guide.slug}`),
  }));

  return [...staticRoutes, ...villaRoutes, ...guideRoutes];
}
