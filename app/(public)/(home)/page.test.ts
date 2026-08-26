import { beforeEach, describe, expect, it, vi } from "vitest";

import { getHomepageCustomerReviewData } from "@/lib/customer-reviews/server";
import { getPublishedGuides } from "@/lib/guides/server";
import {
  getHomeSectionListingPlan,
  getResolvedHomeSections,
} from "@/lib/home-sections/server";
import { DEFAULT_SITE_CONTACT_SETTINGS } from "@/lib/site-contact-settings/defaults";
import { getSiteContactSettings } from "@/lib/site-contact-settings/server";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import { getSiteSettings } from "@/lib/site-settings/server";
import { DEFAULT_SITE_WEB_STYLES } from "@/lib/site-web-styles/defaults";
import { getSiteWebStyles } from "@/lib/site-web-styles/server";
import {
  fetchHouseListings,
  fetchActiveVillaZones,
  fetchHomeListings,
  withVillaCardGalleryPreviews,
} from "@/lib/villas/server";
import { toHomePageSettings } from "@/components/villas/home/client-payload";

const homePageContentMock = vi.hoisted(() => vi.fn(() => null));
const deferredHomeContentMock = vi.hoisted(() => vi.fn(() => null));

vi.mock("server-only", () => ({}));

vi.mock("@/components/admin/login/admin-recovery-hash-redirect", () => ({
  AdminRecoveryHashRedirect: () => null,
}));

vi.mock("@/components/villas/home/page", () => ({
  HomePage: () => null,
  HomePageContent: homePageContentMock,
}));

vi.mock("@/components/villas/home/deferred-home-content", () => ({
  DeferredHomeContent: deferredHomeContentMock,
}));

vi.mock("@/components/villas/home/articles-section", () => ({
  selectHomeGuideSummaries: vi.fn(() => []),
}));

vi.mock("@/components/villas/home/client-payload", () => ({
  toHomePageSettings: vi.fn((settings: unknown) => settings),
}));

vi.mock("@/lib/guides/server", () => ({
  getPublishedGuides: vi.fn(),
}));

vi.mock("@/lib/customer-reviews/server", () => ({
  getHomepageCustomerReviewData: vi.fn(),
}));

vi.mock("@/lib/home-sections/server", () => ({
  getHomeSectionListingPlan: vi.fn(),
  getResolvedHomeSections: vi.fn(),
}));

vi.mock("@/lib/json-ld", () => ({
  serializeJsonLd: vi.fn(() => "{}"),
}));

vi.mock("@/lib/seo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/seo")>()),
  buildHomeJsonLd: vi.fn(() => ({})),
  buildSiteSettingsPageMetadata: vi.fn((metadata: unknown) => metadata),
}));

vi.mock("@/lib/site-settings/server", () => ({
  getSiteSettings: vi.fn(),
}));
vi.mock("@/lib/site-contact-settings/server", () => ({
  getSiteContactSettings: vi.fn(),
}));
vi.mock("@/lib/site-web-styles/server", () => ({
  getSiteWebStyles: vi.fn(),
}));

vi.mock("@/lib/villas/public-dto", () => ({
  toPublicVillaListing: vi.fn((villa: unknown) => villa),
}));

vi.mock("@/lib/villas/server", () => ({
  fetchActiveVillaZones: vi.fn(),
  fetchHouseListings: vi.fn(),
  fetchHomeListings: vi.fn(),
  withVillaCardGalleryPreviews: vi.fn(async (villas: unknown[]) => villas),
}));

const getHomepageCustomerReviewDataMock = vi.mocked(
  getHomepageCustomerReviewData,
);
const getPublishedGuidesMock = vi.mocked(getPublishedGuides);
const getHomeSectionListingPlanMock = vi.mocked(getHomeSectionListingPlan);
const getResolvedHomeSectionsMock = vi.mocked(getResolvedHomeSections);
const getSiteContactSettingsMock = vi.mocked(getSiteContactSettings);
const getSiteSettingsMock = vi.mocked(getSiteSettings);
const getSiteWebStylesMock = vi.mocked(getSiteWebStyles);
const fetchActiveVillaZonesMock = vi.mocked(fetchActiveVillaZones);
const fetchHouseListingsMock = vi.mocked(fetchHouseListings);
const fetchHomeListingsMock = vi.mocked(fetchHomeListings);
const toHomePageSettingsMock = vi.mocked(toHomePageSettings);
const withVillaCardGalleryPreviewsMock = vi.mocked(
  withVillaCardGalleryPreviews,
);

describe("HomePageRoute", () => {
  beforeEach(() => {
    homePageContentMock.mockClear();
    deferredHomeContentMock.mockClear();
    getHomepageCustomerReviewDataMock.mockReset();
    getHomepageCustomerReviewDataMock.mockResolvedValue({
      images: [],
      layout: "proof_wall",
    });
    getPublishedGuidesMock.mockReset();
    getHomeSectionListingPlanMock.mockReset();
    getResolvedHomeSectionsMock.mockReset();
    getSiteContactSettingsMock.mockReset();
    getSiteSettingsMock.mockReset();
    getSiteWebStylesMock.mockReset();
    getSiteWebStylesMock.mockResolvedValue(DEFAULT_SITE_WEB_STYLES);
    fetchActiveVillaZonesMock.mockReset();
    fetchActiveVillaZonesMock.mockResolvedValue([]);
    fetchHouseListingsMock.mockReset();
    fetchHomeListingsMock.mockReset();
    toHomePageSettingsMock.mockClear();
    withVillaCardGalleryPreviewsMock.mockClear();
  });

  it("serializes only the critical rail before the deferred boundary", async () => {
    getPublishedGuidesMock.mockResolvedValue([
      {
        contentBlocks: [],
        coverImage: null,
        createdAt: "2026-08-01T00:00:00.000Z",
        excerpt: "Deferred guide excerpt",
        id: "guide-1",
        isPinned: false,
        publishedAt: "2026-08-01T00:00:00.000Z",
        recommendedHouseIds: [],
        slug: "deferred-guide",
        status: "published",
        tags: [],
        title: "Deferred guide title",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ]);
    getHomepageCustomerReviewDataMock.mockResolvedValue({
      images: [
        {
          alt: "Deferred customer proof",
          id: "review-1",
          order: 1,
          url: "/api/customer-reviews/images/review-1",
        },
      ],
      layout: "proof_wall",
    });
    getHomeSectionListingPlanMock.mockResolvedValue({
      configs: [],
      houseIds: ["critical-villa", "later-villa"],
      layout: {
        degraded: false,
        items: [
          { kind: "rail", key: "critical", enabled: true },
          { kind: "fixed", key: "why_choose", enabled: true },
          { kind: "rail", key: "later", enabled: true },
          { kind: "fixed", key: "articles", enabled: true },
          { kind: "fixed", key: "customer_reviews", enabled: true },
        ],
        source: "config",
      },
      listingLimit: 12,
    });
    const criticalVilla = {
      amenities: [],
      bathrooms: 2,
      bedrooms: 3,
      coverImage: "/critical.webp",
      distanceToSea: "500 เมตร",
      id: "critical-villa",
      people: 8,
      poolType: "private",
      price: 9000,
      title: "Critical villa title",
      zone: "jomtien",
      zoneLabel: "จอมเทียน",
    };
    const laterVilla = {
      ...criticalVilla,
      coverImage: "/later.webp",
      id: "later-villa",
      title: "Deferred villa title",
    };
    fetchHomeListingsMock.mockResolvedValue([criticalVilla, laterVilla]);
    getResolvedHomeSectionsMock.mockResolvedValue({
      degraded: false,
      sections: [
        {
          autoScrollEnabled: false,
          description: "Critical description",
          slug: "critical",
          title: "Critical rail title",
          villas: [criticalVilla],
        },
        {
          autoScrollEnabled: false,
          description: "Deferred description",
          slug: "later",
          title: "Deferred rail title",
          villas: [laterVilla],
        },
      ],
      source: "config",
    });
    getSiteContactSettingsMock.mockResolvedValue({
      degraded: false,
      settings: DEFAULT_SITE_CONTACT_SETTINGS,
      source: "config",
    });
    getSiteSettingsMock.mockResolvedValue({
      degraded: false,
      settings: DEFAULT_SITE_SETTINGS,
      source: "config",
    });

    const { default: HomePageRoute } = await import("./page");
    const route = await HomePageRoute();
    const routeChildren = (route.props as { children: unknown[] }).children;
    const homePageElement = routeChildren[2] as {
      props: { children: { props: { children: AsyncElement } } };
    };
    type AsyncElement = {
      props: Record<string, unknown>;
      type: (props: Record<string, unknown>) => Promise<{
        props: { children: unknown };
      }>;
    };
    const asyncContent = homePageElement.props.children.props.children;
    const resolvedContent = await asyncContent.type(asyncContent.props);
    const renderedChildren = Array.isArray(resolvedContent.props.children)
      ? resolvedContent.props.children
      : [resolvedContent.props.children];
    const deferredBoundary = renderedChildren.find(
      (child: { type?: unknown }) => child?.type === deferredHomeContentMock,
    ) as { props: Record<string, unknown> } | undefined;
    const criticalContent = deferredBoundary?.props.criticalContent as
      | { props: Record<string, unknown>; type: unknown }
      | undefined;

    expect(criticalContent?.type).toBe(homePageContentMock);
    expect(criticalContent?.props.initialHomeSections).toEqual([
      expect.objectContaining({
        slug: "critical",
        villas: [expect.objectContaining({ id: "critical-villa" })],
      }),
    ]);
    expect(criticalContent?.props.homeLayout).toEqual([
      { kind: "rail", key: "critical", enabled: true },
    ]);
    expect(deferredBoundary?.props.homeLayout).toEqual([
      { kind: "rail", key: "critical", enabled: true },
      { kind: "fixed", key: "why_choose", enabled: true },
      { kind: "rail", key: "later", enabled: true },
      { kind: "fixed", key: "articles", enabled: true },
      { kind: "fixed", key: "customer_reviews", enabled: true },
    ]);
    expect(JSON.stringify(criticalContent?.props)).not.toContain(
      "Deferred rail title",
    );
    expect(JSON.stringify(criticalContent?.props)).not.toContain(
      "Deferred guide title",
    );
    expect(JSON.stringify(criticalContent?.props)).not.toContain(
      "Deferred customer proof",
    );
    expect(deferredBoundary?.props.criticalRailKey).toBe("critical");
  });

  it("returns the homepage shell before homepage data finishes", async () => {
    let resolveListingPlan: (plan: {
      configs: [];
      houseIds: string[];
      layout: {
        degraded: false;
        items: [];
        source: "config";
      };
      listingLimit: number;
    }) => void = () => {};
    getPublishedGuidesMock.mockResolvedValue([]);
    getHomeSectionListingPlanMock.mockReturnValue(
      new Promise((resolve) => {
        resolveListingPlan = resolve;
      }),
    );
    fetchHomeListingsMock.mockResolvedValue([]);
    getResolvedHomeSectionsMock.mockResolvedValue({
      degraded: false,
      sections: [],
      source: "config",
    });
    getSiteContactSettingsMock.mockResolvedValue({
      degraded: false,
      settings: DEFAULT_SITE_CONTACT_SETTINGS,
      source: "config",
    });
    getSiteSettingsMock.mockResolvedValue({
      degraded: false,
      settings: DEFAULT_SITE_SETTINGS,
      source: "config",
    });

    const { default: HomePageRoute } = await import("./page");
    const pageResult = await Promise.race([
      HomePageRoute().then(() => "resolved"),
      new Promise<"pending">((resolve) => {
        setTimeout(() => {
          resolve("pending");
        }, 50);
      }),
    ]);

    resolveListingPlan({
      configs: [],
      houseIds: [],
      layout: { degraded: false, items: [], source: "config" },
      listingLimit: 12,
    });

    expect(pageResult).toBe("resolved");
    expect(fetchHomeListingsMock).not.toHaveBeenCalled();
    expect(fetchActiveVillaZonesMock).toHaveBeenCalledOnce();
  });

  it("loads the critical catalog without starting deferred guide or review sources", async () => {
    getHomeSectionListingPlanMock.mockResolvedValue({
      configs: [
        {
          autoScrollEnabled: false,
          ctaEnabled: false,
          ctaHref: null,
          ctaLabel: null,
          description: "Critical",
          displayOrder: 0,
          fallbackMode: "none",
          isActive: true,
          items: [{ houseId: "1328", isActive: true, position: 0 }],
          limitCount: 4,
          mode: "manual",
          sliceOffset: 0,
          slug: "critical",
          title: "Critical",
        },
      ],
      houseIds: ["1328"],
      layout: {
        degraded: false,
        items: [{ kind: "rail", key: "critical", enabled: true }],
        source: "config",
      },
      listingLimit: 12,
    });
    fetchHomeListingsMock.mockResolvedValue([]);
    getResolvedHomeSectionsMock.mockResolvedValue({
      degraded: false,
      sections: [],
      source: "config",
    });
    getSiteContactSettingsMock.mockResolvedValue({
      degraded: false,
      settings: DEFAULT_SITE_CONTACT_SETTINGS,
      source: "config",
    });
    getSiteSettingsMock.mockResolvedValue({
      degraded: false,
      settings: DEFAULT_SITE_SETTINGS,
      source: "config",
    });

    const { default: HomePageRoute } = await import("./page");
    const pagePromise = HomePageRoute();

    await vi.waitFor(() => {
      expect(fetchHomeListingsMock).toHaveBeenCalledWith(["1328"], 4);
      expect(fetchActiveVillaZonesMock).toHaveBeenCalledOnce();
    });
    await pagePromise;
    expect(getPublishedGuidesMock).not.toHaveBeenCalled();
    expect(getHomepageCustomerReviewDataMock).not.toHaveBeenCalled();
  });

  it("allows fallback recommendations when the layout is degraded", async () => {
    getPublishedGuidesMock.mockResolvedValue([]);
    getHomeSectionListingPlanMock.mockResolvedValue({
      configs: [],
      houseIds: [],
      layout: {
        degraded: true,
        items: [{ kind: "rail", key: "featured", enabled: true }],
        source: "fallback",
      },
      listingLimit: 12,
    });
    fetchHomeListingsMock.mockResolvedValue([]);
    getResolvedHomeSectionsMock.mockResolvedValue({
      degraded: false,
      sections: [],
      source: "fallback",
    });
    getSiteContactSettingsMock.mockResolvedValue({
      degraded: false,
      settings: DEFAULT_SITE_CONTACT_SETTINGS,
      source: "config",
    });
    getSiteSettingsMock.mockResolvedValue({
      degraded: false,
      settings: DEFAULT_SITE_SETTINGS,
      source: "config",
    });

    const { default: HomePageRoute } = await import("./page");
    await HomePageRoute();

    await vi.waitFor(() => {
      expect(getResolvedHomeSectionsMock).toHaveBeenCalledWith([], [], true);
    });
  });

  it("resolves selected TikTok villas from the cached catalog with their current title", async () => {
    const currentVilla = {
      amenities: [],
      bathrooms: 2,
      bedrooms: 3,
      coverImage: "/villa-501.webp",
      distanceToSea: "500 เมตร",
      id: "501",
      people: 8,
      poolType: "private",
      price: 9000,
      title: "บ้านพูลวิลล่าชื่อปัจจุบัน",
      zone: "jomtien",
      zoneLabel: "จอมเทียน",
    };
    getHomeSectionListingPlanMock.mockResolvedValue({
      configs: [],
      houseIds: [],
      layout: { degraded: false, items: [], source: "config" },
      listingLimit: 12,
    });
    getSiteSettingsMock.mockResolvedValue({
      degraded: false,
      settings: {
        ...DEFAULT_SITE_SETTINGS,
        tiktok: {
          accountUrl: "",
          videos: [
            {
              houseId: "501",
              url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
              videoId: "7370000000000000001",
            },
          ],
        },
      },
      source: "config",
    });
    getSiteContactSettingsMock.mockResolvedValue({
      degraded: false,
      settings: DEFAULT_SITE_CONTACT_SETTINGS,
      source: "config",
    });
    fetchHouseListingsMock.mockResolvedValue([currentVilla]);

    const { default: HomePageRoute } = await import("./page");
    await HomePageRoute();

    expect(fetchHouseListingsMock).toHaveBeenCalledOnce();
    expect(toHomePageSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tiktok: {
          accountUrl: "",
          videos: [
            expect.objectContaining({
              villa: {
                id: "501",
                title: "บ้านพูลวิลล่าชื่อปัจจุบัน",
              },
            }),
          ],
        },
      }),
      DEFAULT_SITE_CONTACT_SETTINGS,
    );
  });

  it("does not load the villa catalog when TikTok has no selected house", async () => {
    getHomeSectionListingPlanMock.mockResolvedValue({
      configs: [],
      houseIds: [],
      layout: { degraded: false, items: [], source: "config" },
      listingLimit: 12,
    });
    getSiteSettingsMock.mockResolvedValue({
      degraded: false,
      settings: {
        ...DEFAULT_SITE_SETTINGS,
        tiktok: {
          accountUrl: "",
          videos: [
            {
              houseId: null,
              url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
              videoId: "7370000000000000001",
            },
          ],
        },
      },
      source: "config",
    });
    getSiteContactSettingsMock.mockResolvedValue({
      degraded: false,
      settings: DEFAULT_SITE_CONTACT_SETTINGS,
      source: "config",
    });

    const { default: HomePageRoute } = await import("./page");
    await HomePageRoute();

    expect(fetchHouseListingsMock).not.toHaveBeenCalled();
  });
});
