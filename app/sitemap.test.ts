import { beforeEach, describe, expect, it, vi } from "vitest";

import { CACHE_REVALIDATE_SECONDS } from "@/lib/cache-policy";
import sitemap from "./sitemap";
import * as sitemapModule from "./sitemap";
import { getPublishedGuides } from "@/lib/guides/server";
import { fetchHouseListings } from "@/lib/villas/server";

vi.mock("@/lib/guides/server", () => ({
  getPublishedGuides: vi.fn(),
}));

vi.mock("@/lib/seo", () => ({
  absoluteUrl: (path: string) => `https://example.com${path}`,
}));

vi.mock("@/lib/villas/server", () => ({
  fetchHouseListings: vi.fn(),
}));

const fetchHouseListingsMock = vi.mocked(fetchHouseListings);
const getPublishedGuidesMock = vi.mocked(getPublishedGuides);

describe("sitemap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports a twelve-hour ISR window for sitemap.xml", () => {
    expect(sitemapModule).toHaveProperty(
      "revalidate",
      CACHE_REVALIDATE_SECONDS.sitemap,
    );
  });

  it("includes dynamic villa and guide routes when both data sources load", async () => {
    fetchHouseListingsMock.mockResolvedValue([
      {
        amenities: [],
        bathrooms: 2,
        bedrooms: 3,
        coverImage: "https://example.com/villa.jpg",
        distanceToSea: "500m",
        id: "101",
        people: 8,
        poolType: "private",
        price: 9000,
        zone: "jomtien",
        zoneLabel: "Jomtien",
      },
    ]);
    getPublishedGuidesMock.mockResolvedValue([
      {
        contentBlocks: [],
        coverImage: {
          alt: "Guide cover",
          path: "guides/cover.jpg",
          url: "https://example.com/guide.jpg",
        },
        createdAt: "2026-06-01T00:00:00.000Z",
        excerpt: "Guide excerpt",
        id: "guide-1",
        isPinned: true,
        publishedAt: "2026-06-01T00:00:00.000Z",
        recommendedHouseIds: [],
        slug: "family-guide",
        status: "published",
        tags: [],
        title: "Family guide",
        updatedAt: "2026-06-02T00:00:00.000Z",
      },
    ]);

    const routes = await sitemap();
    const villaRoute = routes.find((route) => route.url === "https://example.com/villas/101");
    const guideRoute = routes.find(
      (route) => route.url === "https://example.com/guides/family-guide",
    );

    expect(villaRoute).toMatchObject({
      images: ["https://example.com/villa.jpg"],
      url: "https://example.com/villas/101",
    });
    expect(villaRoute).not.toHaveProperty("lastModified");
    expect(guideRoute).toMatchObject({
      images: ["https://example.com/guide.jpg"],
      lastModified: new Date("2026-06-02T00:00:00.000Z"),
      url: "https://example.com/guides/family-guide",
    });
  });

  it("does not stamp static routes and villa URLs with synthetic freshness dates", async () => {
    fetchHouseListingsMock.mockResolvedValue([
      {
        amenities: [],
        bathrooms: 2,
        bedrooms: 3,
        coverImage: "https://example.com/villa.jpg",
        distanceToSea: "500m",
        id: "101",
        people: 8,
        poolType: "private",
        price: 9000,
        zone: "jomtien",
        zoneLabel: "Jomtien",
      },
    ]);
    getPublishedGuidesMock.mockResolvedValue([]);

    const routes = await sitemap();
    const staticRouteUrls = [
      "https://example.com/",
      "https://example.com/search",
      "https://example.com/guides",
      "https://example.com/villas/101",
    ];

    staticRouteUrls.forEach((url) => {
      expect(routes.find((route) => route.url === url)).not.toHaveProperty(
        "lastModified",
      );
    });
  });

  it("rejects instead of returning a partial sitemap when villa routes cannot load", async () => {
    fetchHouseListingsMock.mockRejectedValue(new Error("villa catalog offline"));
    getPublishedGuidesMock.mockResolvedValue([]);

    await expect(sitemap()).rejects.toThrow("villa catalog offline");
  });

  it("returns a partial sitemap when guide routes cannot load", async () => {
    fetchHouseListingsMock.mockResolvedValue([
      {
        amenities: [],
        bathrooms: 2,
        bedrooms: 3,
        coverImage: "https://example.com/villa.jpg",
        distanceToSea: "500m",
        id: "101",
        people: 8,
        poolType: "private",
        price: 9000,
        zone: "jomtien",
        zoneLabel: "Jomtien",
      },
    ]);
    getPublishedGuidesMock.mockRejectedValue(new Error("guide CMS offline"));

    const routes = await sitemap();

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: "https://example.com/" }),
        expect.objectContaining({ url: "https://example.com/search" }),
        expect.objectContaining({ url: "https://example.com/guides" }),
        expect.objectContaining({ url: "https://example.com/villas/101" }),
      ]),
    );
    expect(routes.some((route) => route.url.startsWith("https://example.com/guides/"))).toBe(
      false,
    );
  });
});
