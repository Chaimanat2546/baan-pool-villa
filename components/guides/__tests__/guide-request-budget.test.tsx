import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { GuidePost } from "@/lib/guides/types";
import type { VillaListing } from "@/lib/villas/types";

import { GuideDetailPage } from "../guide-detail-page";
import { GuideListPage } from "../guide-list-page";

interface MockImageProps {
  alt: string;
  loading?: string;
  preload?: boolean;
  priority?: boolean;
  src: string;
}

vi.mock("next/image", () => ({
  default: ({ alt, loading, preload, priority, src }: MockImageProps) => (
    <span
      aria-label={alt}
      data-loading={loading ?? ""}
      data-preload={preload ? "true" : "false"}
      data-priority={priority ? "true" : "false"}
      data-src={src}
    />
  ),
}));

const guide: GuidePost = {
  contentBlocks: [
    {
      content: [{ text: "เนื้อหาจริงจากบทความ", type: "text" }],
      type: "paragraph",
    },
  ],
  coverImage: null,
  createdAt: "2026-06-03T00:00:00.000Z",
  excerpt: "Guide excerpt",
  id: "guide-1",
  isPinned: false,
  publishedAt: "2026-06-03T00:00:00.000Z",
  recommendedHouseIds: [],
  slug: "guide-1",
  status: "published",
  tags: ["pattaya"],
  title: "Guide 1",
  updatedAt: "2026-06-03T00:00:00.000Z",
};

const villa: VillaListing = {
  amenities: [],
  bathrooms: 4,
  bedrooms: 5,
  coverImage: "https://devillegroups.com/imgs/profile_imgs_large/501.jpg",
  distanceToSea: "500m",
  id: "501",
  people: 12,
  poolType: "private",
  price: 12000,
  zone: "jomtien",
  zoneLabel: "Jomtien",
};

describe("guide detail request budget", () => {
  it("uses document navigation for guide list cards to avoid click-time RSC requests", () => {
    const markup = renderToStaticMarkup(
      <GuideListPage guides={[{ ...guide, coverImage: { alt: "Guide cover", path: "/guide.jpg", url: "/guide.jpg" } }]} />,
    );

    const guideAnchor = markup.match(/<a\b[^>]*href="\/guides\/guide-1"[^>]*>/);

    expect(guideAnchor?.[0]).toContain('href="/guides/guide-1"');
    expect(guideAnchor?.[0]).not.toContain("data-prefetch=");
  });

  it("renders guide content preview without reserved whitespace", () => {
    const markup = renderToStaticMarkup(
      <GuideListPage guides={[guide]} />,
    );

    const guideAnchor = markup.match(/<a\b[^>]*href="\/guides\/guide-1"[^>]*>/);

    expect(guideAnchor?.[0]).toContain("flex h-full flex-col");
    expect(markup).toContain("เนื้อหาจริงจากบทความ");
    expect(markup).not.toContain("Guide excerpt");
    expect(markup).toContain("flex flex-col gap-3 p-4");
    expect(markup).toContain("line-clamp-2 text-xl font-semibold");
    expect(markup).toContain("line-clamp-3 text-sm");
  });

  it("passes guide cover images to the AWS image loader", () => {
    const markup = renderToStaticMarkup(
      <GuideListPage
        guides={[
          {
            ...guide,
            coverImage: {
              alt: "Guide cover",
              path: "guide.jpg",
              url: "https://assets.example.com/guide.jpg",
            },
          },
        ]}
      />,
    );

    expect(markup).toContain('data-src="/api/guides/images/guide-1/cover?v=source-fidelity-1"');
    expect(markup).toContain('data-loading="eager"');
    expect(markup).toContain("/api/guides/images");
  });

  it("does not preload recommended villa card images in duplicate sidebar layouts", () => {
    const markup = renderToStaticMarkup(
      <GuideDetailPage
        guide={guide}
        recommendedVillas={[villa]}
        relatedGuides={[]}
      />,
    );

    const sidebarMarkup = markup.slice(markup.indexOf("data-guide-sidebar"));

    expect(sidebarMarkup).not.toContain('loading="eager"');
  });
});
