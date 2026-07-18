const SIX_HOURS_SECONDS = 6 * 60 * 60;
const TWELVE_HOURS_SECONDS = 12 * 60 * 60;
const TWENTY_FOUR_HOURS_SECONDS = 24 * 60 * 60;

export const SITEMAP_REVALIDATE_SECONDS = TWENTY_FOUR_HOURS_SECONDS;
export type SitemapRevalidateSeconds = typeof SITEMAP_REVALIDATE_SECONDS;

export const CACHE_REVALIDATE_SECONDS = {
  advertisements: TWELVE_HOURS_SECONDS,
  guides: TWELVE_HOURS_SECONDS,
  legalPages: TWELVE_HOURS_SECONDS,
  homeSections: TWELVE_HOURS_SECONDS,
  customerReviews: TWELVE_HOURS_SECONDS,
  siteSettings: TWELVE_HOURS_SECONDS,
  siteSeoSettings: TWELVE_HOURS_SECONDS,
  siteWebStyles: TWELVE_HOURS_SECONDS,
  tiktokOEmbed: TWELVE_HOURS_SECONDS,
  villaDetail: TWELVE_HOURS_SECONDS,
  villaCardImages: TWELVE_HOURS_SECONDS,
  villaImages: TWELVE_HOURS_SECONDS,
  villaListings: SIX_HOURS_SECONDS,
  sitemap: SITEMAP_REVALIDATE_SECONDS,
} as const;

export const CACHE_TAGS = {
  advertisements: "advertisements",
  guide: (slug: string) => `guide:${slug}`,
  guides: "guides",
  legalPage: (slug: string) => `legal-page:${slug}`,
  legalPages: "legal-pages",
  homeSections: "home-sections",
  customerReviews: "customer-reviews",
  siteSettings: "site-settings",
  siteSeoSettings: "site-seo-settings",
  siteWebStyles: "site-web-styles",
  tiktokOEmbed: "tiktok-oembed",
  villaDetail: (id: string) => `villa-detail:${id}`,
  villaDetails: "villa-details",
  villaCardImage: (pageKey: string, id: string) => `villa-card-images:${pageKey}:${id}`,
  villaCardImages: "villa-card-images",
  villaImage: (id: string) => `villa-images:${id}`,
  villaImages: "villa-images",
  villaListings: "villa-listings",
} as const;

export const CACHE_HEADERS = {
  homeSections: "public, s-maxage=43200, stale-while-revalidate=43200",
  customerReviews: "public, s-maxage=43200, stale-while-revalidate=43200",
  villaDetail: "public, s-maxage=43200, stale-while-revalidate=43200",
  villaCardImages: "public, s-maxage=43200, stale-while-revalidate=43200",
  villaImages: "public, s-maxage=43200, stale-while-revalidate=43200",
  villaListings: "public, s-maxage=21600, stale-while-revalidate=21600",
} as const;

export function getVillaDetailPath(id: string): string {
  return `/villas/${id}`;
}
