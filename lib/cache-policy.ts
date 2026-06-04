const ONE_DAY_SECONDS = 60 * 60 * 24;
const FIFTEEN_MINUTES_SECONDS = 15 * 60;

export const CACHE_REVALIDATE_SECONDS = {
  guides: ONE_DAY_SECONDS,
  homeSections: ONE_DAY_SECONDS,
  siteSettings: ONE_DAY_SECONDS,
  tiktokOEmbed: ONE_DAY_SECONDS,
  villaDetail: FIFTEEN_MINUTES_SECONDS,
  villaImages: ONE_DAY_SECONDS,
  villaListings: FIFTEEN_MINUTES_SECONDS,
} as const;

export const CACHE_TAGS = {
  guide: (slug: string) => `guide:${slug}`,
  guides: "guides",
  homeSections: "home-sections",
  siteSettings: "site-settings",
  tiktokOEmbed: "tiktok-oembed",
  villaDetail: (id: string) => `villa-detail:${id}`,
  villaDetails: "villa-details",
  villaImages: (id: string) => `villa-images:${id}`,
  villaListings: "villa-listings",
} as const;

export const CACHE_HEADERS = {
  homeSections: "public, s-maxage=300, stale-while-revalidate=86400",
  villaDetail: "public, s-maxage=900, stale-while-revalidate=900",
  villaImages: "public, s-maxage=86400, stale-while-revalidate=86400",
  villaListings: "public, s-maxage=900, stale-while-revalidate=900",
} as const;

export function getVillaDetailPath(id: string): string {
  return `/villas/${id}`;
}
