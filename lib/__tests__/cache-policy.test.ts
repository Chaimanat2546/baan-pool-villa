import { describe, expect, it } from "vitest";

import {
  CACHE_HEADERS,
  CACHE_REVALIDATE_SECONDS,
  CACHE_TAGS,
  getVillaDetailPath,
} from "../cache-policy";

describe("cache policy", () => {
  it("keeps external villa API cache durations long-lived", () => {
    expect(CACHE_REVALIDATE_SECONDS.villaListings).toBe(60 * 60 * 24 * 7);
    expect(CACHE_REVALIDATE_SECONDS.villaDetail).toBe(60 * 60 * 24 * 7);
  });

  it("keeps Supabase public reads on shorter central TTLs", () => {
    expect(CACHE_REVALIDATE_SECONDS.siteSettings).toBe(60 * 60 * 24);
    expect(CACHE_REVALIDATE_SECONDS.homeSections).toBe(60 * 60 * 24);
    expect(CACHE_REVALIDATE_SECONDS.villaImages).toBe(60 * 60 * 24);
  });

  it("builds stable cache tags and public paths", () => {
    expect(CACHE_TAGS.villaListings).toBe("villa-listings");
    expect(CACHE_TAGS.villaDetails).toBe("villa-details");
    expect(CACHE_TAGS.villaDetail("42")).toBe("villa-detail:42");
    expect(CACHE_TAGS.villaImages("42")).toBe("villa-images:42");
    expect(CACHE_TAGS.siteSettings).toBe("site-settings");
    expect(CACHE_TAGS.homeSections).toBe("home-sections");
    expect(getVillaDetailPath("42")).toBe("/villas/42");
  });

  it("centralizes public route cache-control headers", () => {
    expect(CACHE_HEADERS.villaListings).toBe(
      "public, s-maxage=86400, stale-while-revalidate=604800",
    );
    expect(CACHE_HEADERS.homeSections).toBe(
      "public, s-maxage=300, stale-while-revalidate=86400",
    );
  });
});
