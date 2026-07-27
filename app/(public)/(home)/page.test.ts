import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { fetchHomeListings } from "@/lib/villas/server";

vi.mock("server-only", () => ({}));

vi.mock("@/components/admin/login/admin-recovery-hash-redirect", () => ({
  AdminRecoveryHashRedirect: () => null,
}));

vi.mock("@/components/villas/home/page", () => ({
  HomePage: () => null,
  HomePageContent: () => null,
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
  fetchHomeListings: vi.fn(),
}));

const getPublishedGuidesMock = vi.mocked(getPublishedGuides);
const getHomeSectionListingPlanMock = vi.mocked(getHomeSectionListingPlan);
const getResolvedHomeSectionsMock = vi.mocked(getResolvedHomeSections);
const getSiteContactSettingsMock = vi.mocked(getSiteContactSettings);
const getSiteSettingsMock = vi.mocked(getSiteSettings);
const getSiteWebStylesMock = vi.mocked(getSiteWebStyles);
const fetchHomeListingsMock = vi.mocked(fetchHomeListings);

describe("HomePageRoute", () => {
  beforeEach(() => {
    getPublishedGuidesMock.mockReset();
    getHomeSectionListingPlanMock.mockReset();
    getResolvedHomeSectionsMock.mockReset();
    getSiteContactSettingsMock.mockReset();
    getSiteSettingsMock.mockReset();
    getSiteWebStylesMock.mockReset();
    getSiteWebStylesMock.mockResolvedValue(DEFAULT_SITE_WEB_STYLES);
    fetchHomeListingsMock.mockReset();
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
  });

  it("starts loading villa catalog before guide posts finish", async () => {
    let resolveGuides: (guides: []) => void = () => {};
    const guidesPromise = new Promise<[]>((resolve) => {
      resolveGuides = resolve;
    });
    getPublishedGuidesMock.mockReturnValue(guidesPromise);
    getHomeSectionListingPlanMock.mockResolvedValue({
      configs: [],
      houseIds: ["1328"],
      layout: {
        degraded: false,
        items: [],
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

    try {
      await vi.waitFor(
        () => {
          expect(fetchHomeListingsMock).toHaveBeenCalledWith(["1328"], 12);
        },
        { timeout: 100 },
      );
    } finally {
      resolveGuides([]);
      await vi.waitFor(() => {
        expect(getResolvedHomeSectionsMock).toHaveBeenCalledWith(
          [],
          [],
          false,
        );
      });
      await pagePromise;
    }
  });

  it("allows fallback recommendations when the layout is degraded", async () => {
    getPublishedGuidesMock.mockResolvedValue([]);
    getHomeSectionListingPlanMock.mockResolvedValue({
      configs: [],
      houseIds: [],
      layout: {
        degraded: true,
        items: [],
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
});
