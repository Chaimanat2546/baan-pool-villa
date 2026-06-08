import { describe, expect, it, vi } from "vitest";

import { getPublishedGuides } from "@/lib/guides/server";

vi.mock("server-only", () => ({}));

vi.mock("@/components/guides/guide-list-page", () => ({
  GuideListPage: ({ guides }: { guides: unknown[] }) => ({
    guides,
    type: "GuideListPage",
  }),
}));

vi.mock("@/lib/guides/server", () => ({
  getPublishedGuides: vi.fn(),
}));

vi.mock("@/lib/site-settings/server", () => ({
  getSiteSettings: vi.fn(),
}));

const getPublishedGuidesMock = vi.mocked(getPublishedGuides);

describe("GuidesPageRoute", () => {
  it("renders an empty guide list when guide CMS environment is missing", async () => {
    getPublishedGuidesMock.mockRejectedValue(
      new Error("Home config Supabase environment is missing"),
    );

    const { default: GuidesPageRoute } = await import("./page");

    await expect(GuidesPageRoute()).resolves.toMatchObject({
      props: {
        guides: [],
      },
    });
  });
});
