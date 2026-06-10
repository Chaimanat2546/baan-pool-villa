import { beforeEach, describe, expect, it, vi } from "vitest";

import sitemap from "./sitemap";
import * as sitemapModule from "./sitemap";
import { getPublishedGuides } from "@/lib/guides/server";
import { getPublishedLegalPages } from "@/lib/legal-pages/server";
import { fetchHouseListings } from "@/lib/villas/server";

vi.mock("@/lib/guides/server", () => ({
  getPublishedGuides: vi.fn(),
}));

vi.mock("@/lib/legal-pages/server", () => ({
  getPublishedLegalPages: vi.fn(),
}));

vi.mock("@/lib/seo", () => ({
  absoluteUrl: (path: string) => `https://example.com${path}`,
}));

vi.mock("@/lib/villas/server", () => ({
  fetchHouseListings: vi.fn(),
}));

const fetchHouseListingsMock = vi.mocked(fetchHouseListings);
const getPublishedGuidesMock = vi.mocked(getPublishedGuides);
const getPublishedLegalPagesMock = vi.mocked(getPublishedLegalPages);

describe("sitemap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPublishedLegalPagesMock.mockResolvedValue([]);
  });

  it("exports a route response cache window for sitemap.xml", () => {
    expect(sitemapModule).toHaveProperty("revalidate", 43200);
  });

  it("includes dynamic villa, guide, and legal routes when data sources load", async () => {
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
    getPublishedLegalPagesMock.mockResolvedValue([
      {
        contentBlocks: [],
        createdAt: "2026-06-01T00:00:00.000Z",
        id: "legal-terms",
        publishedAt: "2026-06-01T00:00:00.000Z",
        seoDescription: "Terms SEO",
        slug: "terms",
        status: "published",
        title: "Terms and Conditions",
        updatedAt: "2026-06-03T00:00:00.000Z",
      },
    ]);

    const routes = await sitemap();
    const villaRoute = routes.find((route) => route.url === "https://example.com/villas/101");
    const guideRoute = routes.find(
      (route) => route.url === "https://example.com/guides/family-guide",
    );
    const legalRoute = routes.find((route) => route.url === "https://example.com/terms");

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
    expect(legalRoute).toMatchObject({
      changeFrequency: "monthly",
      lastModified: new Date("2026-06-03T00:00:00.000Z"),
      priority: 0.45,
      url: "https://example.com/terms",
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

  it("returns a partial sitemap when legal page routes cannot load", async () => {
    fetchHouseListingsMock.mockResolvedValue([]);
    getPublishedGuidesMock.mockResolvedValue([]);
    getPublishedLegalPagesMock.mockRejectedValue(new Error("legal CMS offline"));

    const routes = await sitemap();

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: "https://example.com/" }),
        expect.objectContaining({ url: "https://example.com/search" }),
        expect.objectContaining({ url: "https://example.com/guides" }),
      ]),
    );
    expect(routes.some((route) => route.url === "https://example.com/terms")).toBe(false);
    expect(routes.some((route) => route.url === "https://example.com/privacy")).toBe(false);
  });
});
