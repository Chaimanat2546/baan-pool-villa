const ONE_DAY_SECONDS = 60 * 60 * 24;
const ONE_WEEK_SECONDS = ONE_DAY_SECONDS * 7;

export const CACHE_REVALIDATE_SECONDS = {
  homeSections: ONE_DAY_SECONDS,
  siteSettings: ONE_DAY_SECONDS,
  villaDetail: ONE_WEEK_SECONDS,
  villaImages: ONE_DAY_SECONDS,
  villaListings: ONE_WEEK_SECONDS,
} as const;

export const CACHE_TAGS = {
  homeSections: "home-sections",
  siteSettings: "site-settings",
  villaDetail: (id: string) => `villa-detail:${id}`,
  villaDetails: "villa-details",
  villaImages: (id: string) => `villa-images:${id}`,
  villaListings: "villa-listings",
} as const;

export const CACHE_HEADERS = {
  homeSections: "public, s-maxage=300, stale-while-revalidate=86400",
  villaDetail: "public, s-maxage=86400, stale-while-revalidate=604800",
  villaImages: "public, s-maxage=86400, stale-while-revalidate=86400",
  villaListings: "public, s-maxage=86400, stale-while-revalidate=604800",
} as const;

export function getVillaDetailPath(id: string): string {
  return `/villas/${id}`;
}
