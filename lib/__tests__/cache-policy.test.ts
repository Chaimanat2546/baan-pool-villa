import { describe, expect, it } from "vitest";

import {
  CACHE_HEADERS,
  CACHE_REVALIDATE_SECONDS,
  CACHE_TAGS,
  getVillaDetailPath,
} from "../cache-policy";

describe("cache policy", () => {
  it("keeps external villa API cache durations at fifteen minutes", () => {
    expect(CACHE_REVALIDATE_SECONDS.villaListings).toBe(15 * 60);
    expect(CACHE_REVALIDATE_SECONDS.villaDetail).toBe(15 * 60);
  });

  it("keeps Supabase public reads on shorter central TTLs", () => {
    expect(CACHE_REVALIDATE_SECONDS.siteSettings).toBe(60 * 60 * 24);
    expect(CACHE_REVALIDATE_SECONDS.homeSections).toBe(60 * 60 * 24);
    expect(CACHE_REVALIDATE_SECONDS.villaImages).toBe(60 * 60 * 24);
    expect(CACHE_REVALIDATE_SECONDS.guides).toBe(60 * 60 * 24);
    expect(CACHE_REVALIDATE_SECONDS.tiktokOEmbed).toBe(60 * 60 * 24);
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

  it("centralizes public route cache-control headers", () => {
    expect(CACHE_HEADERS.villaListings).toBe(
      "public, s-maxage=900, stale-while-revalidate=900",
    );
    expect(CACHE_HEADERS.villaDetail).toBe(
      "public, s-maxage=900, stale-while-revalidate=900",
    );
    expect(CACHE_HEADERS.homeSections).toBe(
      "public, s-maxage=300, stale-while-revalidate=86400",
    );
  });
});
