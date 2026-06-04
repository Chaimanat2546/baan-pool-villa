import { describe, expect, it } from "vitest";

import type { GuidePost } from "@/lib/guides/types";

import { selectHomeGuides } from "../articles-section";

function makeGuide(index: number): GuidePost {
  return {
    contentBlocks: [],
    coverImage: null,
    createdAt: "2026-06-03T00:00:00.000Z",
    excerpt: `Guide ${index} excerpt`,
    id: `guide-${index}`,
    isPinned: index < 3,
    publishedAt: "2026-06-03T00:00:00.000Z",
    recommendedHouseIds: [],
    slug: `guide-${index}`,
    status: "published",
    tags: [],
    title: `Guide ${index}`,
    updatedAt: "2026-06-03T00:00:00.000Z",
  };
}

describe("selectHomeGuides", () => {
  it("keeps the server-provided pinned-first order and caps the homepage rail at seven guides", () => {
    const guides = Array.from({ length: 9 }, (_, index) => makeGuide(index));

    expect(selectHomeGuides(guides).map((guide) => guide.id)).toEqual([
      "guide-0",
      "guide-1",
      "guide-2",
      "guide-3",
      "guide-4",
      "guide-5",
      "guide-6",
    ]);
  });
});
