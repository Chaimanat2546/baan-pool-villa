import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span aria-label={alt} data-src={src} />
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

import { DEFAULT_SITE_SETTINGS } from "../../../../lib/site-settings/defaults";
import type { GuidePost } from "../../../../lib/guides/types";
import type { ResolvedHomeSection } from "../../../../lib/home-sections/types";
import type { VillaListing } from "../../../../lib/villas/types";
import { HomePage } from "../page";

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

const homeSection: ResolvedHomeSection = {
  description: "ตัวอย่างส่วนจัดแสดง",
  slug: "featured",
  title: "บ้านพักแนะนำ",
  villas: [villa],
};

function makeGuide(index: number): GuidePost {
  return {
    contentBlocks: [],
    coverImage: {
      alt: `Guide ${index} cover`,
      path: `/guide-${index}.jpg`,
      url: `/guide-${index}.jpg`,
    },
    createdAt: "2026-06-03T00:00:00.000Z",
    excerpt: `Guide ${index} excerpt`,
    id: `guide-${index}`,
    isPinned: index === 0,
    publishedAt: "2026-06-03T00:00:00.000Z",
    recommendedHouseIds: [],
    slug: `guide-${index}`,
    status: "published",
    tags: [],
    title: `Guide ${index}`,
    updatedAt: "2026-06-03T00:00:00.000Z",
  };
}

describe("HomePage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders server-provided villas without waiting for a client fetch", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const markup = renderToStaticMarkup(
      <HomePage
        initialHomeSections={[homeSection]}
        initialVillas={[villa]}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );

    expect(markup).toContain('section id="featured"');
    expect(markup).toContain("501");
    expect(markup).toContain("Jomtien");
    expect(markup).not.toContain("animate-pulse");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders TikTok section from settings and places it before recommended guides", () => {
    const markup = renderToStaticMarkup(
      <HomePage
        initialGuides={[makeGuide(1)]}
        initialHomeSections={[homeSection]}
        initialVillas={[villa]}
        settings={{
          ...DEFAULT_SITE_SETTINGS,
          tiktok: {
            accountUrl: "https://www.tiktok.com/@baanpoolvilla",
            videos: [
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000001",
                videoId: "7370000000000000001",
              },
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000002",
                videoId: "7370000000000000002",
              },
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000003",
                videoId: "7370000000000000003",
              },
            ],
          },
        }}
      />,
    );

    expect(markup).toContain("TikTok");
    expect(markup).toContain(
      "https://www.tiktok.com/player/v1/7370000000000000001?controls=1&amp;rel=0",
    );
    expect(markup).toContain(
      "https://www.tiktok.com/player/v1/7370000000000000002?controls=1&amp;rel=0",
    );
    expect(markup).toContain(
      "https://www.tiktok.com/player/v1/7370000000000000003?controls=1&amp;rel=0",
    );
    expect(markup).toContain("Follow us on TikTok");
    expect(markup).toContain('href="https://www.tiktok.com/@baanpoolvilla"');
    expect(markup).toContain('rel="noopener noreferrer"');

    const playerCount = (markup.match(/www\.tiktok\.com\/player\/v1/g) ?? []).length;
    expect(playerCount).toBe(3);

    const tiktokSectionIndex = markup.indexOf("data-home-tiktok");
    const guidesSectionIndex = markup.indexOf('data-home-guides="true"');
    expect(tiktokSectionIndex).toBeGreaterThan(-1);
    expect(guidesSectionIndex).toBeGreaterThan(tiktokSectionIndex);
  });

  it("dedupes TikTok videos by videoId and keeps max 3 visible players", () => {
    const markup = renderToStaticMarkup(
      <HomePage
        initialGuides={[makeGuide(1)]}
        initialHomeSections={[homeSection]}
        initialVillas={[villa]}
        settings={{
          ...DEFAULT_SITE_SETTINGS,
          tiktok: {
            accountUrl: "https://www.tiktok.com/@baanpoolvilla",
            videos: [
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000010",
                videoId: "7370000000000000010",
              },
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000010",
                videoId: "7370000000000000010",
              },
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000011",
                videoId: "7370000000000000011",
              },
            ],
          },
        }}
      />,
    );

    const playerCount = (markup.match(/www\.tiktok\.com\/player\/v1/g) ?? []).length;
    expect(playerCount).toBe(2);

    const duplicatePlayerCount = (markup.match(
      /www\.tiktok\.com\/player\/v1\/7370000000000000010/g,
    ) ?? []).length;

    expect(duplicatePlayerCount).toBe(1);
    expect(markup).toContain(
      "https://www.tiktok.com/player/v1/7370000000000000011?controls=1&amp;rel=0",
    );
  });

  it("dedupes TikTok videos by trimmed videoId and renders canonical IDs", () => {
    const markup = renderToStaticMarkup(
      <HomePage
        initialGuides={[makeGuide(1)]}
        initialHomeSections={[homeSection]}
        initialVillas={[villa]}
        settings={{
          ...DEFAULT_SITE_SETTINGS,
          tiktok: {
            accountUrl: "https://www.tiktok.com/@baanpoolvilla",
            videos: [
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000020",
                videoId: "7370000000000000020",
              },
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000020",
                videoId: " 7370000000000000020 ",
              },
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000021",
                videoId: "7370000000000000021",
              },
            ],
          },
        }}
      />,
    );

    const playerCount = (markup.match(/www\.tiktok\.com\/player\/v1/g) ?? []).length;
    expect(playerCount).toBe(2);

    expect(markup).toContain(
      "https://www.tiktok.com/player/v1/7370000000000000020?controls=1&amp;rel=0",
    );
    expect(markup).toContain(
      "https://www.tiktok.com/player/v1/7370000000000000021?controls=1&amp;rel=0",
    );

    expect(markup).not.toContain(
      "https://www.tiktok.com/player/v1/ 7370000000000000020?controls=1&amp;rel=0",
    );
    expect(markup).not.toContain(
      "https://www.tiktok.com/player/v1/7370000000000000020%20?controls=1&amp;rel=0",
    );
  });

  it("does not render TikTok section when no videos are configured", () => {
    const markup = renderToStaticMarkup(
      <HomePage
        initialGuides={[makeGuide(1)]}
        initialHomeSections={[homeSection]}
        initialVillas={[villa]}
        settings={{
          ...DEFAULT_SITE_SETTINGS,
          tiktok: {
            accountUrl: "https://www.tiktok.com/@baanpoolvilla",
            videos: [],
          },
        }}
      />,
    );

    expect(markup).not.toContain("data-home-tiktok");
    expect(markup).not.toContain("Follow us on TikTok");
  });
});
