import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";
import { fetchHouseListings } from "@/lib/villas/server";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      changeFrequency: "daily",
      lastModified: now,
      priority: 1,
      url: absoluteUrl("/"),
    },
    {
      changeFrequency: "daily",
      lastModified: now,
      priority: 0.9,
      url: absoluteUrl("/search"),
    },
  ];

  try {
    const listings = await fetchHouseListings();

    return [
      ...staticRoutes,
      ...listings.map((listing) => ({
        changeFrequency: "daily" as const,
        images: listing.coverImage ? [listing.coverImage] : undefined,
        lastModified: now,
        priority: 0.8,
        url: absoluteUrl(`/villas/${listing.id}`),
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
