import { describe, expect, it } from "vitest";

import {
  CACHE_HEADERS,
  CACHE_REVALIDATE_SECONDS,
  CACHE_TAGS,
  SITEMAP_REVALIDATE_SECONDS,
  getVillaDetailPath,
} from "../cache-policy";

describe("cache policy", () => {
  const SIX_HOURS_SECONDS = 6 * 60 * 60;
  const TWELVE_HOURS_SECONDS = 12 * 60 * 60;

  it("keeps the public villa catalog API cache at six hours", () => {
    expect(CACHE_REVALIDATE_SECONDS.villaListings).toBe(SIX_HOURS_SECONDS);
  });

  it("keeps the sitemap route cache at twenty-four hours", () => {
    expect(CACHE_REVALIDATE_SECONDS.sitemap).toBe(SITEMAP_REVALIDATE_SECONDS);
    expect(SITEMAP_REVALIDATE_SECONDS).toBe(24 * 60 * 60);
  });

  it("keeps public villa detail data cache durations at twelve hours", () => {
    expect(CACHE_REVALIDATE_SECONDS.villaDetail).toBe(TWELVE_HOURS_SECONDS);
  });

  it("keeps public Supabase and third-party reads on twelve-hour TTLs", () => {
    expect(CACHE_REVALIDATE_SECONDS.siteSettings).toBe(TWELVE_HOURS_SECONDS);
    expect(CACHE_REVALIDATE_SECONDS.homeSections).toBe(TWELVE_HOURS_SECONDS);
    expect(CACHE_REVALIDATE_SECONDS.customerReviews).toBe(TWELVE_HOURS_SECONDS);
    expect(CACHE_REVALIDATE_SECONDS.villaCardImages).toBe(TWELVE_HOURS_SECONDS);
    expect(CACHE_REVALIDATE_SECONDS.villaImages).toBe(TWELVE_HOURS_SECONDS);
    expect(CACHE_REVALIDATE_SECONDS.guides).toBe(TWELVE_HOURS_SECONDS);
    expect(CACHE_REVALIDATE_SECONDS.advertisements).toBe(TWELVE_HOURS_SECONDS);
    expect(CACHE_REVALIDATE_SECONDS.tiktokOEmbed).toBe(TWELVE_HOURS_SECONDS);
    expect(CACHE_REVALIDATE_SECONDS.legalPages).toBe(TWELVE_HOURS_SECONDS);
  });

  it("builds stable cache tags and public paths", () => {
    expect(CACHE_TAGS.guide("family-pool-villa")).toBe(
      "guide:family-pool-villa",
    );
    expect(CACHE_TAGS.guides).toBe("guides");
    expect(CACHE_TAGS.advertisements).toBe("advertisements");
    expect(CACHE_TAGS.villaListings).toBe("villa-listings");
    expect(CACHE_TAGS.villaDetails).toBe("villa-details");
    expect(CACHE_TAGS.villaDetail("42")).toBe("villa-detail:42");
    expect(CACHE_TAGS.villaImages).toBe("villa-images");
    expect(CACHE_TAGS.villaImage("42")).toBe("villa-images:42");
    expect(CACHE_TAGS.villaCardImages).toBe("villa-card-images");
    expect(CACHE_TAGS.villaCardImage("home", "42")).toBe(
      "villa-card-images:home:42",
    );
    expect(CACHE_TAGS.siteSettings).toBe("site-settings");
    expect(CACHE_TAGS.tiktokOEmbed).toBe("tiktok-oembed");
    expect(CACHE_TAGS.homeSections).toBe("home-sections");
    expect(CACHE_TAGS.customerReviews).toBe("customer-reviews");
    expect(CACHE_TAGS.legalPages).toBe("legal-pages");
    expect(CACHE_TAGS.legalPage("terms")).toBe("legal-page:terms");
    expect(getVillaDetailPath("42")).toBe("/villas/42");
  });

  it("does not keep route-level rendered response TTLs in the data cache policy", () => {
    expect("homePage" in CACHE_REVALIDATE_SECONDS).toBe(false);
    expect("searchPage" in CACHE_REVALIDATE_SECONDS).toBe(false);
  });

  it("centralizes public route cache-control headers", () => {
    expect(CACHE_HEADERS.villaListings).toBe(
      "public, s-maxage=21600, stale-while-revalidate=21600",
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
    expect(CACHE_HEADERS.villaCardImages).toBe(
      "public, s-maxage=43200, stale-while-revalidate=43200",
    );
  });
});
