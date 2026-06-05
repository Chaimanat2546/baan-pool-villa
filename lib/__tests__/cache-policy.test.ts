import { describe, expect, it } from "vitest";

import {
  CACHE_HEADERS,
  CACHE_REVALIDATE_SECONDS,
  CACHE_TAGS,
  getVillaDetailPath,
} from "../cache-policy";

describe("cache policy", () => {
  const TWELVE_HOURS_SECONDS = 12 * 60 * 60;

  it("keeps public villa API cache durations at twelve hours", () => {
    expect(CACHE_REVALIDATE_SECONDS.villaListings).toBe(TWELVE_HOURS_SECONDS);
    expect(CACHE_REVALIDATE_SECONDS.villaDetail).toBe(TWELVE_HOURS_SECONDS);
  });

  it("keeps public Supabase and third-party reads on twelve-hour TTLs", () => {
    expect(CACHE_REVALIDATE_SECONDS.siteSettings).toBe(TWELVE_HOURS_SECONDS);
    expect(CACHE_REVALIDATE_SECONDS.homeSections).toBe(TWELVE_HOURS_SECONDS);
    expect(CACHE_REVALIDATE_SECONDS.villaImages).toBe(TWELVE_HOURS_SECONDS);
    expect(CACHE_REVALIDATE_SECONDS.guides).toBe(TWELVE_HOURS_SECONDS);
    expect(CACHE_REVALIDATE_SECONDS.tiktokOEmbed).toBe(TWELVE_HOURS_SECONDS);
  });

  it("builds stable cache tags and public paths", () => {
    expect(CACHE_TAGS.guide("family-pool-villa")).toBe(
      "guide:family-pool-villa",
    );
    expect(CACHE_TAGS.guides).toBe("guides");
    expect(CACHE_TAGS.villaListings).toBe("villa-listings");
    expect(CACHE_TAGS.villaDetails).toBe("villa-details");
    expect(CACHE_TAGS.villaDetail("42")).toBe("villa-detail:42");
    expect(CACHE_TAGS.villaImages("42")).toBe("villa-images:42");
    expect(CACHE_TAGS.siteSettings).toBe("site-settings");
    expect(CACHE_TAGS.tiktokOEmbed).toBe("tiktok-oembed");
    expect(CACHE_TAGS.homeSections).toBe("home-sections");
    expect(getVillaDetailPath("42")).toBe("/villas/42");
  });

  it("defines shared route-level revalidate seconds for homepage and search", () => {
    expect(CACHE_REVALIDATE_SECONDS.homePage).toBe(TWELVE_HOURS_SECONDS);
    expect(CACHE_REVALIDATE_SECONDS.searchPage).toBe(TWELVE_HOURS_SECONDS);
  });

  it("centralizes public route cache-control headers", () => {
    expect(CACHE_HEADERS.villaListings).toBe(
      "public, s-maxage=43200, stale-while-revalidate=43200",
    );
    expect(CACHE_HEADERS.villaDetail).toBe(
      "public, s-maxage=43200, stale-while-revalidate=43200",
    );
    expect(CACHE_HEADERS.homeSections).toBe(
      "public, s-maxage=43200, stale-while-revalidate=43200",
    );
    expect(CACHE_HEADERS.villaImages).toBe(
      "public, s-maxage=43200, stale-while-revalidate=43200",
    );
  });
});
