import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { selectHomeGuideSummaries } from "@/lib/guides/public-dto";
import type { GuidePost } from "@/lib/guides/types";

import { ArticlesSection } from "../articles-section";

interface MockImageProps {
  alt: string;
  src: string;
}

vi.mock("next/image", () => ({
  default: ({ alt, src }: MockImageProps) =>
    createElement("span", { "aria-label": alt, "data-src": src }),
}));

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
      "/api/guides/images/guide-0/cover",
    );
    expect(JSON.stringify(summaries)).not.toContain("contentBlocks");
  });
});

describe("ArticlesSection", () => {
  it("reserves article card body space so the CTA stays aligned", () => {
    const guides = selectHomeGuideSummaries([makeGuide(0)]);
    const markup = renderToStaticMarkup(
      createElement(ArticlesSection, { guides }),
    );

    const guideAnchor = markup.match(/<a\b[^>]*href="\/guides\/guide-0"[^>]*>/);

    expect(guideAnchor?.[0]).toContain("flex h-full");
    expect(guideAnchor?.[0]).toContain("flex-col");
    expect(markup).toContain("flex flex-1 flex-col p-6");
    expect(markup).toContain("line-clamp-2 min-h-14");
    expect(markup).toContain("line-clamp-3 min-h-18");
    expect(markup).toContain("mt-auto inline-flex");
  });
});
