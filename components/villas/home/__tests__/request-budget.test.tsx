import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { GuidePost } from "@/lib/guides/types";
import type { VillaListing } from "@/lib/villas/types";

import { ArticlesSection, selectHomeGuideSummaries } from "../articles-section";
import { VillaRail } from "../villa-rail";

interface MockImageProps {
  alt: string;
  loading?: "eager" | "lazy";
  preload?: boolean;
  priority?: boolean;
  src: string;
}

vi.mock("next/image", () => ({
  default: ({ alt, loading, preload, priority, src }: MockImageProps) => (
    <span
      aria-label={alt}
      data-loading={loading}
      data-preload={preload ? "true" : "false"}
      data-priority={priority ? "true" : "false"}
      data-src={src}
    />
  ),
}));

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

const guide: GuidePost = {
  contentBlocks: [],
  coverImage: {
    alt: "Guide cover",
    path: "/guide.jpg",
    url: "/guide.jpg",
  },
  createdAt: "2026-06-03T00:00:00.000Z",
  excerpt: "Guide excerpt",
  id: "guide-1",
  isPinned: true,
  publishedAt: "2026-06-03T00:00:00.000Z",
  recommendedHouseIds: [],
  slug: "guide-1",
  status: "published",
  tags: ["pattaya"],
  title: "Guide 1",
  updatedAt: "2026-06-03T00:00:00.000Z",
};

describe("homepage request budget", () => {
  it("eagerly loads villa rail card images without preloading them", () => {
    const markup = renderToStaticMarkup(
      <VillaRail
        cta
        description="Recommended villas"
        title="Recommended"
        villas={[villa]}
      />,
    );

    expect(markup).toContain('data-loading="eager"');
    expect(markup).not.toContain('data-preload="true"');
    expect(markup).toContain('href="/search"');
    expect(markup).not.toContain('data-prefetch="false" href="/search"');
    expect(markup).toContain('data-scroll-rail-controls="sides"');
    expect(markup).not.toContain("mt-3 hidden min-h-11");
  });

  it("honors the villa count provided by admin-resolved home sections", () => {
    const villas = Array.from({ length: 12 }, (_, index) => ({
      ...villa,
      coverImage: `https://devillegroups.com/imgs/profile_imgs_large/${index + 1}.jpg`,
      id: String(index + 1),
    }));
    const markup = renderToStaticMarkup(
      <VillaRail
        cta
        description="Recommended villas"
        title="Recommended"
        villas={villas}
      />,
    );

    const renderedVillaCards = markup.match(
      /<article[^>]*data-villa-card-style=/g,
    ) ?? [];
    const renderedImages =
      markup.match(
        /src="\/api\/houses\/images\/\d+"/g,
      ) ?? [];

    expect(renderedVillaCards).toHaveLength(12);
    expect(renderedImages).toHaveLength(12);
    expect(markup).not.toContain("devillegroups.com");
    expect(markup).toContain('href="/villas/12"');
  });

  it("does not priority-preload article rail images and uses document navigation for guide routes", () => {
    const markup = renderToStaticMarkup(
      <ArticlesSection guides={selectHomeGuideSummaries([guide])} />,
    );

    expect(markup).not.toContain('loading="eager"');
    expect(markup).toContain('href="/guides/guide-1"');
    expect(markup).not.toContain('data-prefetch="false" href="/guides/guide-1"');
  });
});
