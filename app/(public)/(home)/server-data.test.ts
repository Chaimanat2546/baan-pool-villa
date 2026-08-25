import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PUBLIC_RATE_LIMIT_POLICIES,
  resetPublicRateLimitForTests,
} from "@/lib/api/rate-limit";
import { getHomepageCustomerReviewData } from "@/lib/customer-reviews/server";
import { getPublishedGuides } from "@/lib/guides/server";
import {
  getHomeSectionListingPlan,
  getResolvedHomeSections,
} from "@/lib/home-sections/server";
import {
  fetchActiveVillaZones,
  fetchHomeListings,
  withVillaCardGalleryPreviews,
} from "@/lib/villas/server";
import type { VillaListing } from "@/lib/villas/types";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/customer-reviews/server", () => ({
  getHomepageCustomerReviewData: vi.fn(),
}));

vi.mock("@/lib/guides/server", () => ({
  getPublishedGuides: vi.fn(),
}));

vi.mock("@/lib/home-sections/server", () => ({
  getHomeSectionListingPlan: vi.fn(),
  getResolvedHomeSections: vi.fn(),
}));

vi.mock("@/lib/villas/server", () => ({
  fetchActiveVillaZones: vi.fn(),
  fetchHomeListings: vi.fn(),
  withVillaCardGalleryPreviews: vi.fn(),
}));

const getHomepageCustomerReviewDataMock = vi.mocked(
  getHomepageCustomerReviewData,
);
const getPublishedGuidesMock = vi.mocked(getPublishedGuides);
const getHomeSectionListingPlanMock = vi.mocked(getHomeSectionListingPlan);
const getResolvedHomeSectionsMock = vi.mocked(getResolvedHomeSections);
const fetchActiveVillaZonesMock = vi.mocked(fetchActiveVillaZones);
const fetchHomeListingsMock = vi.mocked(fetchHomeListings);
const withVillaCardGalleryPreviewsMock = vi.mocked(
  withVillaCardGalleryPreviews,
);

function makeVilla(id: string): VillaListing {
  return {
    amenities: [],
    bathrooms: 2,
    bedrooms: 3,
    coverImage: `https://images.example.com/${id}.webp`,
    distanceToSea: "500 เมตร",
    id,
    people: 8,
    poolType: "private",
    price: 9000,
    title: `Villa ${id}`,
    zone: "jomtien",
    zoneLabel: "จอมเทียน",
  };
}

function setupHomeDataMocks() {
  vi.clearAllMocks();
  fetchActiveVillaZonesMock.mockResolvedValue([]);
  fetchHomeListingsMock.mockResolvedValue([makeVilla("1"), makeVilla("2")]);
  withVillaCardGalleryPreviewsMock.mockImplementation(async (villas) => villas);
  getHomepageCustomerReviewDataMock.mockResolvedValue({
      images: [
        {
          alt: "Customer proof",
          id: "review-1",
          order: 1,
          url: "/api/customer-reviews/images/review-1",
        },
      ],
      layout: "proof_wall",
  });
  getPublishedGuidesMock.mockResolvedValue([
      {
        contentBlocks: [{ type: "paragraph", text: "private full article" }],
        coverImage: {
          alt: "Guide cover",
          path: "guide.webp",
          url: "https://assets.example.com/guide.webp",
        },
        createdAt: "2026-08-01T00:00:00.000Z",
        excerpt: "Guide excerpt",
        id: "guide-1",
        isPinned: false,
        publishedAt: "2026-08-01T00:00:00.000Z",
        recommendedHouseIds: ["2"],
        slug: "guide-one",
        status: "published",
        tags: ["pattaya"],
        title: "Guide one",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
  ]);
  getHomeSectionListingPlanMock.mockResolvedValue({
      configs: [],
      houseIds: ["1", "2"],
      layout: {
        degraded: false,
        items: [
          { kind: "rail", key: "critical", enabled: true },
          { kind: "fixed", key: "why_choose", enabled: true },
          { kind: "rail", key: "later", enabled: true },
          { kind: "fixed", key: "customer_reviews", enabled: true },
          { kind: "fixed", key: "articles", enabled: true },
          { kind: "fixed", key: "tiktok", enabled: false },
          { kind: "fixed", key: "faq", enabled: false },
          { kind: "fixed", key: "contact", enabled: false },
        ],
        source: "config",
      },
      listingLimit: 12,
  });
  getResolvedHomeSectionsMock.mockResolvedValue({
      degraded: false,
      sections: [
        {
          autoScrollEnabled: false,
          description: "Critical description",
          slug: "critical",
          title: "Critical rail",
          villas: [makeVilla("1")],
        },
        {
          autoScrollEnabled: true,
          description: "Later description",
          slug: "later",
          title: "Later rail",
          villas: [makeVilla("2")],
        },
      ],
      source: "config",
  });
}

beforeEach(() => {
  setupHomeDataMocks();
  resetPublicRateLimitForTests();
});

describe("deferred homepage server data", () => {
  it("loads the complete bounded critical-rail payload without starting deferred sources", async () => {
    const criticalVillas = Array.from({ length: 12 }, (_, index) =>
      makeVilla(String(index + 1)),
    );
    getHomeSectionListingPlanMock.mockResolvedValue({
      configs: [
        {
          autoScrollEnabled: false,
          ctaEnabled: false,
          ctaHref: null,
          ctaLabel: null,
          description: "Critical description",
          displayOrder: 0,
          fallbackMode: "none",
          isActive: true,
          items: criticalVillas.map((item, position) => ({
            houseId: item.id,
            isActive: true,
            position,
          })),
          limitCount: 12,
          mode: "manual",
          sliceOffset: 0,
          slug: "critical",
          title: "Critical rail",
        },
        {
          autoScrollEnabled: false,
          ctaEnabled: false,
          ctaHref: null,
          ctaLabel: null,
          description: "Later description",
          displayOrder: 1,
          fallbackMode: "none",
          isActive: true,
          items: [{ houseId: "99", isActive: true, position: 0 }],
          limitCount: 1,
          mode: "manual",
          sliceOffset: 0,
          slug: "later",
          title: "Later rail",
        },
      ],
      houseIds: [...criticalVillas.map((villa) => villa.id), "99"],
      layout: {
        degraded: false,
        items: [
          { kind: "rail", key: "critical", enabled: true },
          { kind: "rail", key: "later", enabled: true },
        ],
        source: "config",
      },
      listingLimit: 12,
    });
    fetchHomeListingsMock.mockResolvedValue(criticalVillas);
    getResolvedHomeSectionsMock.mockResolvedValue({
      degraded: false,
      sections: [
        {
          autoScrollEnabled: false,
          description: "Critical description",
          slug: "critical",
          title: "Critical rail",
          villas: criticalVillas,
        },
      ],
      source: "config",
    });
    const serverData = await import("./server-data");
    const getInitialHomePageData = (
      serverData as typeof serverData & {
        getInitialHomePageData?: () => Promise<{
          sections: Array<{ villas: VillaListing[] }>;
        }>;
      }
    ).getInitialHomePageData;

    expect(getInitialHomePageData).toBeTypeOf("function");
    const payload = await getInitialHomePageData!();

    expect(payload.sections[0]?.villas.map((villa) => villa.id)).toEqual(
      criticalVillas.map((villa) => villa.id),
    );
    expect(fetchHomeListingsMock).toHaveBeenCalledWith(
      criticalVillas.map((villa) => villa.id),
      12,
    );
    expect(withVillaCardGalleryPreviewsMock).toHaveBeenCalledWith(
      criticalVillas,
    );
    expect(getPublishedGuidesMock).not.toHaveBeenCalled();
    expect(getHomepageCustomerReviewDataMock).not.toHaveBeenCalled();
  });

  it("uses the first enabled fixed section as the initial homepage content", async () => {
    getHomeSectionListingPlanMock.mockResolvedValue({
      configs: [],
      houseIds: ["1", "2"],
      layout: {
        degraded: false,
        items: [
          { kind: "fixed", key: "why_choose", enabled: true },
          { kind: "rail", key: "critical", enabled: true },
        ],
        source: "config",
      },
      listingLimit: 12,
    });
    const { getInitialHomePageData } = await import("./server-data");

    await expect(getInitialHomePageData()).resolves.toMatchObject({
      criticalItem: { kind: "fixed", key: "why_choose", enabled: true },
      sections: [],
    });
    expect(fetchHomeListingsMock).not.toHaveBeenCalled();
  });

  it("logs and degrades when preparing critical villa-card previews fails", async () => {
    const error = new Error("Network connection lost.");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    withVillaCardGalleryPreviewsMock.mockRejectedValue(error);
    const { getInitialHomePageData } = await import("./server-data");

    await expect(getInitialHomePageData()).resolves.toMatchObject({
      degradedSources: expect.objectContaining({ villaCatalog: true }),
      sections: [],
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Unable to prepare homepage critical villa cards",
      error,
    );
  });

  it("builds an initial payload containing only the document critical rail", async () => {
    const serverData = await import("./server-data");
    const data = await serverData.getHomePageData();
    const buildInitialHomePayload = (
      serverData as typeof serverData & {
        buildInitialHomePayload?: (value: typeof data) => unknown;
      }
    ).buildInitialHomePayload;

    expect(buildInitialHomePayload?.(data)).toEqual({
      criticalRailKey: "critical",
      degradedSources: {
        guidePosts: false,
        homeSections: false,
        villaCatalog: false,
      },
      layout: [
        { kind: "rail", key: "critical", enabled: true },
        { kind: "fixed", key: "why_choose", enabled: true },
        { kind: "rail", key: "later", enabled: true },
        { kind: "fixed", key: "customer_reviews", enabled: true },
        { kind: "fixed", key: "articles", enabled: true },
      ],
      sections: [
        expect.objectContaining({
          slug: "critical",
          title: "Critical rail",
          villas: [expect.objectContaining({ id: "1" })],
        }),
      ],
    });
    expect(JSON.stringify(buildInitialHomePayload?.(data))).not.toContain(
      "Later rail",
    );
    expect(JSON.stringify(buildInitialHomePayload?.(data))).not.toContain(
      "Guide one",
    );
    expect(JSON.stringify(buildInitialHomePayload?.(data))).not.toContain(
      "Customer proof",
    );
  });

  it("excludes the supplied critical rail and returns public DTOs for deferred content", async () => {
    const { getDeferredHomePayload } = await import("./server-data");

    const payload = await getDeferredHomePayload("critical");

    expect(payload.layout).not.toContainEqual({
      kind: "rail",
      key: "critical",
      enabled: true,
    });
    expect(payload.sections.map((section) => section.slug)).toEqual(["later"]);
    expect(payload.sections[0]?.villas[0]?.coverImage).toBe(
      "/api/houses/images/2",
    );
    expect(payload.guides).toEqual([
      expect.objectContaining({
        coverImageUrl: "/api/guides/images/guide-one/cover",
        id: "guide-1",
        slug: "guide-one",
        title: "Guide one",
      }),
    ]);
    expect(payload.guides[0]).not.toHaveProperty("contentBlocks");
    expect(payload.customerReviews).toEqual({
      images: [
        {
          alt: "Customer proof",
          id: "review-1",
          order: 1,
          url: "/api/customer-reviews/images/review-1",
        },
      ],
      layout: "proof_wall",
    });
    expect(fetchActiveVillaZonesMock).not.toHaveBeenCalled();
  });

  it("returns only enabled layout rails and empties disabled fixed payloads", async () => {
    getHomeSectionListingPlanMock.mockResolvedValue({
      configs: [],
      houseIds: ["1", "2", "3"],
      layout: {
        degraded: false,
        items: [
          { kind: "rail", key: "critical", enabled: true },
          { kind: "rail", key: "later", enabled: false },
          { kind: "fixed", key: "why_choose", enabled: true },
          { kind: "fixed", key: "customer_reviews", enabled: false },
          { kind: "fixed", key: "articles", enabled: false },
          { kind: "fixed", key: "tiktok", enabled: false },
          { kind: "fixed", key: "faq", enabled: false },
          { kind: "fixed", key: "contact", enabled: false },
        ],
        source: "config",
      },
      listingLimit: 12,
    });
    getResolvedHomeSectionsMock.mockResolvedValue({
      degraded: false,
      sections: [
        {
          autoScrollEnabled: false,
          description: "Critical description",
          slug: "critical",
          title: "Critical rail",
          villas: [makeVilla("1")],
        },
        {
          autoScrollEnabled: false,
          description: "Disabled description",
          slug: "later",
          title: "Disabled rail",
          villas: [makeVilla("2")],
        },
        {
          autoScrollEnabled: false,
          description: "Unlisted description",
          slug: "unlisted",
          title: "Unlisted rail",
          villas: [makeVilla("3")],
        },
      ],
      source: "config",
    });
    const { getDeferredHomePayload } = await import("./server-data");

    const payload = await getDeferredHomePayload("critical");

    expect(payload.sections).toEqual([]);
    expect(payload.layout).toEqual([
      { kind: "fixed", key: "why_choose", enabled: true },
    ]);
    expect(payload.guides).toEqual([]);
    expect(payload.customerReviews.images).toEqual([]);
  });
});

describe("GET /api/home-deferred", () => {
  it("returns the shared deferred payload with the public home cache policy", async () => {
    const { GET } = await import("../api/home-deferred/route");
    const response = await GET(
      new Request("https://example.com/api/home-deferred?criticalRail=critical", {
        headers: { "CF-Connecting-IP": "203.0.113.81" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=43200, stale-while-revalidate=43200",
    );
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        sections: [expect.objectContaining({ slug: "later" })],
      }),
    );
  });

  it("uses the document critical rail when current CMS ordering has changed", async () => {
    getHomeSectionListingPlanMock.mockResolvedValue({
      configs: [],
      houseIds: ["1", "2"],
      layout: {
        degraded: false,
        items: [
          { kind: "rail", key: "fresh-critical", enabled: true },
          { kind: "rail", key: "document-critical", enabled: true },
          { kind: "fixed", key: "why_choose", enabled: true },
          { kind: "fixed", key: "customer_reviews", enabled: true },
          { kind: "fixed", key: "articles", enabled: true },
          { kind: "fixed", key: "tiktok", enabled: false },
          { kind: "fixed", key: "faq", enabled: false },
          { kind: "fixed", key: "contact", enabled: false },
        ],
        source: "config",
      },
      listingLimit: 12,
    });
    getResolvedHomeSectionsMock.mockResolvedValue({
      degraded: false,
      sections: [
        {
          autoScrollEnabled: false,
          description: "Fresh description",
          slug: "fresh-critical",
          title: "Fresh critical rail",
          villas: [makeVilla("2")],
        },
        {
          autoScrollEnabled: false,
          description: "Document description",
          slug: "document-critical",
          title: "Document critical rail",
          villas: [makeVilla("1")],
        },
      ],
      source: "config",
    });
    const { GET } = await import("../api/home-deferred/route");

    const response = await GET(
      new Request(
        "https://example.com/api/home-deferred?criticalRail=document-critical",
        { headers: { "CF-Connecting-IP": "203.0.113.83" } },
      ),
    );
    const payload = await response.json();

    expect(payload.sections.map((section: { slug: string }) => section.slug)).toEqual([
      "fresh-critical",
    ]);
    expect(payload.layout).not.toContainEqual({
      kind: "rail",
      key: "document-critical",
      enabled: true,
    });
  });

  it("rate limits repeated requests before loading deferred data", async () => {
    const { GET } = await import("../api/home-deferred/route");
    const request = new Request(
      "https://example.com/api/home-deferred?criticalRail=critical",
      {
      headers: { "CF-Connecting-IP": "203.0.113.82" },
      },
    );

    for (
      let index = 0;
      index < PUBLIC_RATE_LIMIT_POLICIES.publicCatalog.limit;
      index += 1
    ) {
      expect((await GET(request)).status).toBe(200);
    }

    getHomeSectionListingPlanMock.mockClear();
    fetchHomeListingsMock.mockClear();
    const blocked = await GET(request);

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Cache-Control")).toBe("no-store");
    expect(blocked.headers.get("Retry-After")).toBe("60");
    expect(getHomeSectionListingPlanMock).not.toHaveBeenCalled();
    expect(fetchHomeListingsMock).not.toHaveBeenCalled();
  });
});
