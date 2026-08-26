import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { selectHomeGuideSummaries } from "@/lib/guides/public-dto";
import type { GuidePost } from "@/lib/guides/types";

import { ArticlesSection } from "../articles-section";

interface MockImageProps {
  alt: string;
  quality?: number;
  src: string;
  [key: string]: unknown;
}

vi.mock("next/image", () => ({
  default: ({
    alt,
    fill,
    loader,
    preload,
    quality,
    src,
    ...props
  }: MockImageProps) => {
    void fill;
    void loader;
    void preload;

    return createElement("span", {
      ...props,
      "aria-label": alt,
      "data-quality": quality,
      "data-src": src,
    });
  },
}));

vi.mock("@/components/ui/near-viewport-activation", () => ({
  useImageActivation: () => true,
}));

function makeGuide(index: number): GuidePost {
  return {
    contentBlocks: [
      {
        content: [{ text: `Guide ${index} article content`, type: "text" }],
        type: "paragraph",
      },
    ],
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
      "/api/guides/images/guide-0/cover?v=source-fidelity-1",
    );
    expect(summaries[0]?.contentPreview).toBe("Guide 0 article content");
    expect(JSON.stringify(summaries)).not.toContain("contentBlocks");
  });
});

describe("ArticlesSection", () => {
  it("requests full article rail images at quality 80", () => {
    const guides = selectHomeGuideSummaries([makeGuide(0)]);
    const markup = renderToStaticMarkup(
      createElement(ArticlesSection, { guides }),
    );

    expect(markup).toContain('data-progressive-full="true"');
    expect(markup).toContain('data-quality="80"');
  });

  it("renders article content preview without reserved whitespace", () => {
    const guides = selectHomeGuideSummaries([makeGuide(0)]);
    const markup = renderToStaticMarkup(
      createElement(ArticlesSection, { guides }),
    );

    const guideAnchor = markup.match(/<a\b[^>]*href="\/guides\/guide-0"[^>]*>/);

    expect(guideAnchor?.[0]).toContain("flex h-full");
    expect(guideAnchor?.[0]).toContain("flex-col");
    expect(markup).toContain("Guide 0 article content");
    expect(markup).not.toContain("Guide 0 excerpt");
    expect(markup).toContain("flex flex-col gap-3 p-4");
    expect(markup).toContain("line-clamp-2 text-xl font-semibold");
    expect(markup).toContain("line-clamp-3 text-sm");
  });
});
