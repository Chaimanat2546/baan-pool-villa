/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const routerPushMock = vi.hoisted(() => vi.fn());

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span aria-label={alt} data-src={src} />
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
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
  description: "Section description",
  slug: "featured",
  title: "Featured",
  villas: [villa],
};

const filterSummary = {
  maxAvailablePrice: 12000,
  zones: [{ value: "jomtien", label: "Jomtien" }],
};

const destinationVillas = [
  { coverImage: "https://devillegroups.com/imgs/profile_imgs_large/501-destination.jpg" },
];

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
    routerPushMock.mockClear();
    vi.unstubAllGlobals();
  });

  it("renders home-section rails and hero filters from compact payload without initialVillas", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const markup = renderToStaticMarkup(
      <HomePage
        initialHomeSections={[homeSection]}
        filterSummary={filterSummary}
        destinationVillas={destinationVillas}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );

    expect(markup).toContain('section id="featured"');
    expect(markup).toContain("501");
    expect(markup).toContain("Jomtien");
    expect(markup).toContain("max=\"12000\"");
    expect(markup).not.toContain("max=\"1000\"");
    expect(markup).toContain('id="recommendations"');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces degraded homepage sources as non-visible data attributes", () => {
    const markup = renderToStaticMarkup(
      <HomePage
        initialHomeSections={[homeSection]}
        filterSummary={filterSummary}
        destinationVillas={destinationVillas}
        settings={DEFAULT_SITE_SETTINGS}
        degradedSources={{
          guidePosts: false,
          homeSections: true,
          siteSettings: true,
          villaCatalog: false,
        }}
      />,
    );

    expect(markup).toContain('data-home-degraded="true"');
    expect(markup).toContain(
      'data-home-degraded-sources="siteSettings,homeSections"',
    );
  });

  it("uses compact destinationVillas payload for destination cards", () => {
    const compactDestinationVillas = [
      { coverImage: "https://example.com/destination-1.jpg" },
      { coverImage: "https://example.com/destination-2.jpg" },
    ];

    const markup = renderToStaticMarkup(
      <HomePage
        initialHomeSections={[homeSection]}
        filterSummary={filterSummary}
        destinationVillas={compactDestinationVillas}
        settings={{
          ...DEFAULT_SITE_SETTINGS,
          tiktok: {
            accountUrl: "https://www.tiktok.com/@baanpoolvilla",
            videos: [
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000001000",
                videoId: "7370000000000001000",
              },
            ],
          },
        }}
      />,
    );

    const destinationHeader = "สำรวจจุดหมายปลายทางของเรา";
    const destinationSectionStart = markup.indexOf(destinationHeader);
    const tiktokSectionStart = markup.indexOf("data-home-tiktok");

    const destinationsMarkup = markup.slice(
      destinationSectionStart,
      tiktokSectionStart,
    );

    expect(destinationSectionStart).toBeGreaterThan(-1);
    expect(tiktokSectionStart).toBeGreaterThan(destinationSectionStart);

    expect(destinationsMarkup).toContain("https://example.com/destination-1.jpg");
    expect(destinationsMarkup).toContain("https://example.com/destination-2.jpg");
  });

  it("renders TikTok section from settings without server preview props and keeps guide placement after it", () => {
    const markup = renderToStaticMarkup(
      <HomePage
        initialGuides={[makeGuide(1)]}
        initialHomeSections={[homeSection]}
        filterSummary={filterSummary}
        destinationVillas={destinationVillas}
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
    expect(markup).not.toContain("https://p16-sign.tiktokcdn-us.com/cover-1.jpeg");
    expect(markup).toContain("ติดตามพวกเราบน TikTok");
    expect(markup).toContain('href="https://www.tiktok.com/@baanpoolvilla"');
    expect(markup).toContain('rel="noopener noreferrer"');

    const tiktokSectionIndex = markup.indexOf("data-home-tiktok");
    const guidesSectionIndex = markup.indexOf('data-home-guides="true"');
    expect(tiktokSectionIndex).toBeGreaterThan(-1);
    expect(guidesSectionIndex).toBeGreaterThan(tiktokSectionIndex);

    const tiktokSectionMarkup = markup.slice(tiktokSectionIndex, guidesSectionIndex);
    expect(tiktokSectionMarkup).toContain("snap-x");
    expect(tiktokSectionMarkup).not.toContain("lg:grid-cols-3");
    expect(tiktokSectionMarkup).not.toContain("www.tiktok.com/player/v1");

    const posterCount = (tiktokSectionMarkup.match(/data-tiktok-poster/g) ?? [])
      .length;
    expect(posterCount).toBe(3);

    const guidesSectionMarkup = markup.slice(guidesSectionIndex);
    expect(guidesSectionMarkup).toContain("Guide 1");
  });

  it("dedupes TikTok videos by videoId and keeps max 6 visible posters", () => {
    const markup = renderToStaticMarkup(
      <HomePage
        initialGuides={[makeGuide(1)]}
        initialHomeSections={[homeSection]}
        filterSummary={filterSummary}
        destinationVillas={destinationVillas}
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
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000012",
                videoId: "7370000000000000012",
              },
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000013",
                videoId: "7370000000000000013",
              },
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000014",
                videoId: "7370000000000000014",
              },
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000015",
                videoId: "7370000000000000015",
              },
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000014",
                videoId: " 7370000000000000014 ",
              },
            ],
          },
        }}
      />,
    );

    const posterCount = (markup.match(/data-tiktok-poster/g) ?? []).length;
    expect(posterCount).toBe(6);
    expect(markup).not.toContain("www.tiktok.com/player/v1");

    expect(markup).toContain("video/7370000000000000010");
    expect(markup).toContain("video/7370000000000000014");
    expect(markup).toContain("video/7370000000000000015");
    expect(markup).not.toContain("video/7370000000000000016");
    expect(markup).not.toContain("video/7370000000000000017");

    const duplicatePlayerCount = (
      markup.match(/video\/7370000000000000010/g) ?? []
    ).length;

    expect(duplicatePlayerCount).toBe(1);
    expect(markup).toContain("video/7370000000000000015");
  });

  it("limits TikTok render to first 6 normalized videos when 8 are configured", () => {
    const markup = renderToStaticMarkup(
      <HomePage
        initialGuides={[makeGuide(1)]}
        initialHomeSections={[homeSection]}
        filterSummary={filterSummary}
        destinationVillas={destinationVillas}
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
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000004",
                videoId: "7370000000000000004",
              },
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000005",
                videoId: "7370000000000000005",
              },
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000006",
                videoId: "7370000000000000006",
              },
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000007",
                videoId: "7370000000000000007",
              },
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000007",
                videoId: " 7370000000000000007 ",
              },
            ],
          },
        }}
      />,
    );

    const posterCount = (markup.match(/data-tiktok-poster/g) ?? []).length;
    expect(posterCount).toBe(6);
    expect(markup).not.toContain("www.tiktok.com/player/v1");

    expect(markup).toContain("video/7370000000000000001");
    expect(markup).toContain("video/7370000000000000006");
    expect(markup).not.toContain("video/7370000000000000007");
  });

  it("dedupes TikTok videos by trimmed videoId and renders canonical IDs", () => {
    const markup = renderToStaticMarkup(
      <HomePage
        initialGuides={[makeGuide(1)]}
        initialHomeSections={[homeSection]}
        filterSummary={filterSummary}
        destinationVillas={destinationVillas}
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

    const posterCount = (markup.match(/data-tiktok-poster/g) ?? []).length;
    expect(posterCount).toBe(2);
    expect(markup).not.toContain("www.tiktok.com/player/v1");

    expect(markup).toContain("video/7370000000000000020");
    expect(markup).toContain("video/7370000000000000021");

    expect(markup).not.toContain("video/ 7370000000000000020");
    expect(markup).not.toContain("video/7370000000000000020 ");
  });

  it("does not render TikTok section when no videos are configured", () => {
    const markup = renderToStaticMarkup(
      <HomePage
        initialGuides={[makeGuide(1)]}
        initialHomeSections={[homeSection]}
        filterSummary={filterSummary}
        destinationVillas={destinationVillas}
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

  it("does not use Next router navigation for hero search", async () => {
    const openMock = vi.fn();
    vi.stubGlobal("open", openMock);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <HomePage
          initialHomeSections={[homeSection]}
          filterSummary={filterSummary}
          destinationVillas={destinationVillas}
          settings={DEFAULT_SITE_SETTINGS}
        />,
      );
    });

    const searchButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("ค้นหา"),
    );

    expect(searchButton).toBeTruthy();

    await act(async () => {
      searchButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(routerPushMock).not.toHaveBeenCalled();
    expect(openMock).toHaveBeenCalledWith(
      "/search?guests=2&bedrooms=1&maxPrice=12000",
      "_self",
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
