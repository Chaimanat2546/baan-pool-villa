import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getGuideBySlug,
  getPublishedGuides,
  resolveGuideRecommendedVillas,
} from "@/lib/guides/server";
import type { GuidePost } from "@/lib/guides/types";
import { getSiteSettings } from "@/lib/site-settings/server";
import { DEFAULT_SITE_WEB_STYLES } from "@/lib/site-web-styles/defaults";
import { getSiteWebStyles } from "@/lib/site-web-styles/server";
import { fetchHouseListings } from "@/lib/villas/server";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

vi.mock("@/components/guides/guide-detail-page", () => ({
  GuideDetailBottomSections: () => null,
  GuideDetailBottomSectionsSkeleton: () => null,
  GuideDetailPage: () => null,
  RecommendedVillaSidebar: () => null,
  RecommendedVillaSidebarSkeleton: () => null,
}));

vi.mock("@/lib/guides/server", () => ({
  getGuideBySlug: vi.fn(),
  getPublishedGuides: vi.fn(),
  resolveGuideRecommendedVillas: vi.fn(),
}));

vi.mock("@/lib/site-settings/server", () => ({
  getSiteSettings: vi.fn(),
}));

vi.mock("@/lib/site-web-styles/server", () => ({
  getSiteWebStyles: vi.fn(),
}));

vi.mock("@/lib/villas/server", () => ({
  fetchHouseListings: vi.fn(),
}));

const guide: GuidePost = {
  contentBlocks: [],
  coverImage: null,
  createdAt: "2026-06-03T00:00:00.000Z",
  excerpt: "Guide excerpt",
  id: "guide-1",
  isPinned: false,
  publishedAt: "2026-06-03T00:00:00.000Z",
  recommendedHouseIds: ["501"],
  slug: "guide-1",
  status: "published",
  tags: ["pattaya"],
  title: "Guide 1",
  updatedAt: "2026-06-03T00:00:00.000Z",
};

const fetchHouseListingsMock = vi.mocked(fetchHouseListings);
const getGuideBySlugMock = vi.mocked(getGuideBySlug);
const getPublishedGuidesMock = vi.mocked(getPublishedGuides);
const getSiteSettingsMock = vi.mocked(getSiteSettings);
const getSiteWebStylesMock = vi.mocked(getSiteWebStyles);
const resolveGuideRecommendedVillasMock = vi.mocked(resolveGuideRecommendedVillas);

beforeEach(() => {
  vi.clearAllMocks();
  getSiteWebStylesMock.mockResolvedValue(DEFAULT_SITE_WEB_STYLES);
});

describe("guide detail route config", () => {
  it("does not export generateStaticParams so guide pages are not prebuilt", async () => {
    const pageModule = await import("./page");

    expect(pageModule).not.toHaveProperty("generateStaticParams");
  });

  it("does not block route rendering on streamed guide extras", async () => {
    getGuideBySlugMock.mockResolvedValue(guide);

    const { default: GuideDetailRoute } = await import("./page");

    await GuideDetailRoute({
      params: Promise.resolve({ slug: "guide-1" }),
    });

    expect(getGuideBySlugMock).toHaveBeenCalledWith("guide-1");
    expect(fetchHouseListingsMock).not.toHaveBeenCalled();
    expect(getPublishedGuidesMock).not.toHaveBeenCalled();
    expect(getSiteSettingsMock).not.toHaveBeenCalled();
    expect(resolveGuideRecommendedVillasMock).not.toHaveBeenCalled();
  });

  it("does not reserve sidebar space when no villas are configured", async () => {
    getGuideBySlugMock.mockResolvedValue({ ...guide, recommendedHouseIds: [] });

    const { default: GuideDetailRoute } = await import("./page");
    const route = await GuideDetailRoute({
      params: Promise.resolve({ slug: "guide-1" }),
    });
    const children = (
      route as { props: { children: Array<{ props?: { sidebar?: unknown } }> } }
    ).props.children;

    expect(children[1]?.props?.sidebar).toBeUndefined();
  });
});
