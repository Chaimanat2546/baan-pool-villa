import { describe, expect, it, vi } from "vitest";

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

describe("guide detail route config", () => {
  it("does not export generateStaticParams so guide pages are not prebuilt", async () => {
    const pageModule = await import("./page");

    expect(pageModule).not.toHaveProperty("generateStaticParams");
  });
});
