const TWELVE_HOURS_SECONDS = 12 * 60 * 60;

export const CACHE_REVALIDATE_SECONDS = {
  guides: TWELVE_HOURS_SECONDS,
  legalPages: TWELVE_HOURS_SECONDS,
  homeSections: TWELVE_HOURS_SECONDS,
  siteSettings: TWELVE_HOURS_SECONDS,
  tiktokOEmbed: TWELVE_HOURS_SECONDS,
  villaDetail: TWELVE_HOURS_SECONDS,
  villaImages: TWELVE_HOURS_SECONDS,
  villaListings: TWELVE_HOURS_SECONDS,
} as const;

export const CACHE_TAGS = {
  guide: (slug: string) => `guide:${slug}`,
  guides: "guides",
  legalPage: (slug: string) => `legal-page:${slug}`,
  legalPages: "legal-pages",
  homeSections: "home-sections",
  siteSettings: "site-settings",
  tiktokOEmbed: "tiktok-oembed",
  villaDetail: (id: string) => `villa-detail:${id}`,
  villaDetails: "villa-details",
  villaImage: (id: string) => `villa-images:${id}`,
  villaImages: "villa-images",
  villaListings: "villa-listings",
} as const;

export const CACHE_HEADERS = {
  homeSections: "public, s-maxage=43200, stale-while-revalidate=43200",
  villaDetail: "public, s-maxage=43200, stale-while-revalidate=43200",
  villaImages: "public, s-maxage=43200, stale-while-revalidate=43200",
  villaListings: "public, s-maxage=43200, stale-while-revalidate=43200",
} as const;

export function getVillaDetailPath(id: string): string {
  return `/villas/${id}`;
}
