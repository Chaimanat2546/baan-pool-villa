import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPublishedGuides } from "@/lib/guides/server";
import {
  getActiveHomeSectionHouseIds,
  getResolvedHomeSections,
} from "@/lib/home-sections/server";
import { getSiteSettings } from "@/lib/site-settings/server";
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
  getActiveHomeSectionHouseIds: vi.fn(),
  getResolvedHomeSections: vi.fn(),
}));

vi.mock("@/lib/json-ld", () => ({
  serializeJsonLd: vi.fn(() => "{}"),
}));

vi.mock("@/lib/seo", () => ({
  buildHomeJsonLd: vi.fn(() => ({})),
  buildSiteSettingsPageMetadata: vi.fn((metadata: unknown) => metadata),
}));

vi.mock("@/lib/site-settings/server", () => ({
  getSiteSettings: vi.fn(),
}));

vi.mock("@/lib/villas/filters", () => ({
  getMaxVillaPrice: vi.fn(() => 0),
  getUniqueZones: vi.fn(() => []),
}));

vi.mock("@/lib/villas/public-dto", () => ({
  toPublicVillaListing: vi.fn((villa: unknown) => villa),
}));

vi.mock("@/lib/villas/server", () => ({
  fetchHomeListings: vi.fn(),
}));

const getPublishedGuidesMock = vi.mocked(getPublishedGuides);
const getActiveHomeSectionHouseIdsMock = vi.mocked(getActiveHomeSectionHouseIds);
const getResolvedHomeSectionsMock = vi.mocked(getResolvedHomeSections);
const getSiteSettingsMock = vi.mocked(getSiteSettings);
const fetchHomeListingsMock = vi.mocked(fetchHomeListings);

describe("HomePageRoute", () => {
  beforeEach(() => {
    getPublishedGuidesMock.mockReset();
    getActiveHomeSectionHouseIdsMock.mockReset();
    getResolvedHomeSectionsMock.mockReset();
    getSiteSettingsMock.mockReset();
    fetchHomeListingsMock.mockReset();
  });

  it("returns the homepage shell before homepage data finishes", async () => {
    let resolveHouseIds: (houseIds: string[]) => void = () => {};
    getPublishedGuidesMock.mockResolvedValue([]);
    getActiveHomeSectionHouseIdsMock.mockReturnValue(
      new Promise<string[]>((resolve) => {
        resolveHouseIds = resolve;
      }),
    );
    fetchHomeListingsMock.mockResolvedValue([]);
    getResolvedHomeSectionsMock.mockResolvedValue({
      degraded: false,
      sections: [],
      source: "config",
    });
    getSiteSettingsMock.mockResolvedValue({
      degraded: false,
      settings: { seo: { title: "Home" } },
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

    resolveHouseIds([]);

    expect(pageResult).toBe("resolved");
    expect(fetchHomeListingsMock).not.toHaveBeenCalled();
  });

  it("starts loading villa catalog before guide posts finish", async () => {
    let resolveGuides: (guides: []) => void = () => {};
    const guidesPromise = new Promise<[]>((resolve) => {
      resolveGuides = resolve;
    });
    getPublishedGuidesMock.mockReturnValue(guidesPromise);
    getActiveHomeSectionHouseIdsMock.mockResolvedValue(["1328"]);
    fetchHomeListingsMock.mockResolvedValue([]);
    getResolvedHomeSectionsMock.mockResolvedValue({
      degraded: false,
      sections: [],
      source: "config",
    });
    getSiteSettingsMock.mockResolvedValue({
      degraded: false,
      settings: { seo: { title: "Home" } },
      source: "config",
    });

    const { default: HomePageRoute } = await import("./page");
    const pagePromise = HomePageRoute();

    try {
      await vi.waitFor(
        () => {
          expect(fetchHomeListingsMock).toHaveBeenCalledWith(["1328"]);
        },
        { timeout: 100 },
      );
    } finally {
      resolveGuides([]);
      await pagePromise;
    }
  });
});
