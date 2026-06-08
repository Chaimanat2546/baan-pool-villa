import { describe, expect, it, vi } from "vitest";

import { getPublishedGuides } from "@/lib/guides/server";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

vi.mock("@/components/guides/guide-detail-page", () => ({
  GuideDetailPage: () => null,
}));

vi.mock("@/lib/guides/server", () => ({
  getGuideBySlug: vi.fn(),
  getPublishedGuides: vi.fn(),
  resolveGuideRecommendedVillas: vi.fn(),
}));

vi.mock("@/lib/site-settings/server", () => ({
  getSiteSettings: vi.fn(),
}));

vi.mock("@/lib/villas/server", () => ({
  fetchHouseListings: vi.fn(),
}));

const getPublishedGuidesMock = vi.mocked(getPublishedGuides);

describe("guide detail generateStaticParams", () => {
  it("returns guide slugs when the guide CMS is available", async () => {
    getPublishedGuidesMock.mockResolvedValue([
      {
        id: "guide-1",
        title: "Family guide",
        slug: "family-guide",
        excerpt: "Pick the right villa.",
        coverImage: null,
        contentBlocks: [],
        tags: [],
        recommendedHouseIds: [],
        status: "published",
        isPinned: false,
        publishedAt: null,
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-02T00:00:00.000Z",
      },
    ]);

    const { generateStaticParams } = await import("./page");

    await expect(generateStaticParams()).resolves.toEqual([
      { slug: "family-guide" },
    ]);
  });

  it("does not fail the build when guide CMS environment is missing", async () => {
    getPublishedGuidesMock.mockRejectedValue(
      new Error("Home config Supabase environment is missing"),
    );

    const { generateStaticParams } = await import("./page");

    await expect(generateStaticParams()).resolves.toEqual([]);
  });
});
