import { describe, expect, it } from "vitest";

import {
  selectHomeGuideSummaries,
  toPublicGuideSummary,
} from "../public-dto";
import type { GuidePost } from "../types";

const guide: GuidePost = {
  contentBlocks: [],
  coverImage: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  excerpt: "Guide excerpt",
  id: "guide-1",
  isPinned: false,
  publishedAt: "2026-06-01T00:00:00.000Z",
  recommendedHouseIds: [],
  slug: "guide",
  status: "published",
  tags: ["pattaya"],
  title: "Guide",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

describe("public guide DTOs", () => {
  it("clones tags so callers cannot mutate the source guide", () => {
    const summary = toPublicGuideSummary(guide);

    summary.tags.push("changed");

    expect(guide.tags).toEqual(["pattaya"]);
  });

  it("uses the guide cover proxy instead of exposing the asset URL", () => {
    const summary = toPublicGuideSummary({
      ...guide,
      coverImage: { alt: "Cover", path: "guide.webp", url: "https://assets.example/guide.webp" },
    });

    expect(summary.coverImageUrl).toBe("/api/guides/images/guide/cover");
  });

  it("omits an invalid guide cover URL", () => {
    const summary = toPublicGuideSummary({
      ...guide,
      coverImage: { alt: "Cover", path: "guide.webp", url: "javascript:alert(1)" },
    });

    expect(summary.coverImageUrl).toBeNull();
    expect(summary.hasCoverImage).toBe(false);
  });

  it("builds the homepage guide payload from server-safe DTOs and caps it at seven", () => {
    const summaries = selectHomeGuideSummaries(
      Array.from({ length: 8 }, (_, index) => ({
        ...guide,
        id: `guide-${index + 1}`,
        slug: `guide-${index + 1}`,
        title: `Guide ${index + 1}`,
      })),
    );

    expect(summaries).toHaveLength(7);
    expect(summaries.map((summary) => summary.id)).toEqual([
      "guide-1",
      "guide-2",
      "guide-3",
      "guide-4",
      "guide-5",
      "guide-6",
      "guide-7",
    ]);
  });
});
