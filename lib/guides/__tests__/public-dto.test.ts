import { describe, expect, it } from "vitest";

import { toPublicGuideSummary } from "../public-dto";
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
});
