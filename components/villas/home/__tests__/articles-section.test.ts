import { describe, expect, it } from "vitest";

import type { GuidePost } from "@/lib/guides/types";

import { selectHomeGuideSummaries } from "../articles-section";

function makeGuide(index: number): GuidePost {
  return {
    contentBlocks: [],
    coverImage: {
      alt: `Guide ${index} cover`,
      path: `guide-${index}.jpg`,
      url: `https://hmxuqvgyliuwbytcodwm.supabase.co/storage/v1/object/public/guide-assets/guides/guide-${index}.jpg`,
    },
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

describe("selectHomeGuideSummaries", () => {
  it("keeps the server-provided pinned-first order and caps the homepage rail at seven guides", () => {
    const guides = Array.from({ length: 9 }, (_, index) => makeGuide(index));

    const summaries = selectHomeGuideSummaries(guides);

    expect(summaries.map((guide) => guide.id)).toEqual([
      "guide-0",
      "guide-1",
      "guide-2",
      "guide-3",
      "guide-4",
      "guide-5",
      "guide-6",
    ]);
    expect(summaries[0]?.coverImageUrl).toBe(
      "https://hmxuqvgyliuwbytcodwm.supabase.co/storage/v1/object/public/guide-assets/guides/guide-0.jpg",
    );
    expect(JSON.stringify(summaries)).not.toContain("contentBlocks");
  });
});
