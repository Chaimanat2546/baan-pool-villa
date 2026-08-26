import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { selectHomeGuideSummaries } from "@/lib/guides/public-dto";
import type { GuidePost } from "@/lib/guides/types";
import type { VillaListing } from "@/lib/villas/types";

import { ArticlesSection } from "../articles-section";
import { TikTokSection } from "../tiktok-section";
import { VillaRail } from "../villa-rail";

vi.mock("next/image", () => ({
  default: ({ alt, loading, preload, priority, src, ...props }: Record<string, unknown>) => (
    <span
      {...props}
      aria-label={typeof alt === "string" ? alt : undefined}
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
  it("loads only the first villa card eagerly before visitors scroll the rail", () => {
    const markup = renderToStaticMarkup(
      <VillaRail
        cta
        description="Recommended villas"
        title="Recommended"
        villas={Array.from({ length: 4 }, (_, index) => ({
          ...villa,
          id: String(index + 1),
        }))}
      />,
    );

    expect(markup.match(/data-loading="eager"/g)).toHaveLength(1);
    expect(markup.match(/data-loading="lazy"/g)?.length).toBeGreaterThan(0);
    expect(markup).not.toContain('data-preload="true"');
    expect(markup).toContain('href="/search"');
    expect(markup).not.toContain('data-prefetch="false" href="/search"');
    expect(markup).toContain('data-scroll-rail-controls="sides"');
    expect(markup).not.toContain("mt-3 hidden min-h-11");
  });

  it("limits full villa cover activation to the initial rail window", () => {
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
    const previewImages = markup.match(/data-progressive-preview="true"/g) ?? [];
    const fullImages = markup.match(/data-progressive-full="true"/g) ?? [];
    const preloadedImages = markup.match(/data-preload="true"/g) ?? [];

    expect(renderedVillaCards).toHaveLength(12);
    expect(previewImages).toHaveLength(4);
    expect(fullImages).toHaveLength(4);
    expect(preloadedImages.length).toBeLessThanOrEqual(1);
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

  it("renders resolved TikTok villa links without a client villa catalog endpoint", () => {
    const markup = renderToStaticMarkup(
      <TikTokSection
        tiktok={{
          accountUrl: "",
          videos: [
            {
              url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
              videoId: "7370000000000000001",
              villa: { id: "501", title: "บ้านพูลวิลล่าชื่อปัจจุบัน" },
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('href="/villas/501"');
    expect(markup).not.toContain("/api/houses");
  });
});
