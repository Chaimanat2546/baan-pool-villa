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

vi.mock("embla-carousel-autoplay", () => ({
  default: () => ({ name: "autoplay" }),
}));

vi.mock("embla-carousel-react", () => ({
  default: () => [vi.fn(), undefined],
}));

import { DEFAULT_SITE_CONTACT_SETTINGS } from "../../../../lib/site-contact-settings/defaults";
import { DEFAULT_SITE_SETTINGS } from "../../../../lib/site-settings/defaults";
import type { GuidePost } from "../../../../lib/guides/types";
import type { ResolvedHomeSection } from "../../../../lib/home-sections/types";
import type { HomePageLayoutItem } from "../../../../lib/home-sections/types";
import type { VillaListing } from "../../../../lib/villas/types";
import { toHomePageSettings } from "../client-payload";
import { selectHomeGuideSummaries } from "../../../../lib/guides/public-dto";
import { HomePage, HomePageContent } from "../page";

const DEFAULT_HOME_SETTINGS = toHomePageSettings(
  DEFAULT_SITE_SETTINGS,
  DEFAULT_SITE_CONTACT_SETTINGS,
);

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
  autoScrollEnabled: false,
  description: "Section description",
  slug: "featured",
  title: "Featured",
  villas: [villa],
};

const filterSummary = {
  maxAvailablePrice: 12000,
  zones: [{ value: "jomtien", label: "Jomtien" }],
};

const customerReviews = {
  images: [
    {
      alt: "Customer chat",
      id: "review-1",
      order: 1,
      url: "https://example.supabase.co/storage/v1/object/public/site-assets/customer-reviews/review-1.webp",
    },
    {
      alt: "Transfer slip",
      id: "review-2",
      order: 2,
      url: "https://example.supabase.co/storage/v1/object/public/site-assets/customer-reviews/review-2.webp",
    },
  ],
  layout: "proof_wall" as const,
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
        settings={DEFAULT_HOME_SETTINGS}
      />,
    );

    expect(markup).toContain('section id="featured"');
    expect(markup).toContain("501");
    expect(markup).toContain("Jomtien");
    expect(markup).toContain("max=\"12000\"");
    expect(markup).not.toContain("max=\"1000\"");
    expect(markup).toContain('id="recommendations"');
    expect(markup).not.toContain("สำรวจจุดหมายปลายทางของเรา");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders streamed villa cards from the explicit server style snapshot", () => {
    const markup = renderToStaticMarkup(
      <HomePageContent
        initialHomeSections={[homeSection]}
        settings={DEFAULT_HOME_SETTINGS}
        villaCardStyle="gallery"
      />,
    );

    expect(markup).toContain('data-villa-card-style="gallery"');
    expect(markup).not.toContain('data-villa-card-style="classic"');
  });

  it("renders enabled homepage sections in the configured order", () => {
    const layout: HomePageLayoutItem[] = [
      { kind: "fixed", key: "contact", enabled: true },
      { kind: "rail", key: "featured", enabled: true },
      { kind: "fixed", key: "why_choose", enabled: true },
      { kind: "fixed", key: "tiktok", enabled: false },
      { kind: "fixed", key: "customer_reviews", enabled: false },
      { kind: "fixed", key: "articles", enabled: false },
      { kind: "fixed", key: "faq", enabled: false },
    ];

    const markup = renderToStaticMarkup(
      <HomePageContent
        homeLayout={layout}
        initialHomeSections={[homeSection]}
        settings={DEFAULT_HOME_SETTINGS}
      />,
    );

    expect(markup.indexOf('id="contact"')).toBeLessThan(
      markup.indexOf('id="featured"'),
    );
    expect(markup.indexOf('id="featured"')).toBeLessThan(
      markup.indexOf('id="recommendations"'),
    );
    expect(markup).not.toContain("data-home-tiktok");
  });

  it("keeps the first enabled rail critical and defers later rails plus image-heavy fixed sections", () => {
    const laterRail: ResolvedHomeSection = {
      ...homeSection,
      slug: "later",
      title: "Later rail",
    };
    const markup = renderToStaticMarkup(
      <HomePageContent
        customerReviews={customerReviews}
        homeLayout={[
          { kind: "rail", key: "featured", enabled: true },
          { kind: "fixed", key: "why_choose", enabled: true },
          { kind: "rail", key: "later", enabled: true },
          { kind: "fixed", key: "tiktok", enabled: true },
          { kind: "fixed", key: "customer_reviews", enabled: true },
          { kind: "fixed", key: "articles", enabled: true },
          { kind: "fixed", key: "faq", enabled: true },
          { kind: "fixed", key: "contact", enabled: true },
        ]}
        initialGuides={selectHomeGuideSummaries([makeGuide(1)])}
        initialHomeSections={[homeSection, laterRail]}
        settings={{
          ...DEFAULT_HOME_SETTINGS,
          tiktok: {
            accountUrl: "",
            videos: [
              {
                url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
                videoId: "7370000000000000001",
              },
            ],
          },
        }}
      />,
    );

    expect(markup.match(/data-near-viewport-activation/g)).toHaveLength(4);
    expect(markup.indexOf('id="featured"')).toBeLessThan(
      markup.indexOf("data-near-viewport-activation"),
    );
    expect(markup).toContain('id="later"');
    expect(markup).toContain('data-home-tiktok="true"');
    expect(markup).toContain('data-home-customer-reviews="proof_wall"');
    expect(markup).toContain('data-home-guides="true"');
  });

  it("keeps hero markup before movable homepage sections", () => {
    const markup = renderToStaticMarkup(
      <HomePage
        homeLayout={[
          { kind: "fixed", key: "contact", enabled: true },
          { kind: "fixed", key: "why_choose", enabled: false },
          { kind: "fixed", key: "tiktok", enabled: false },
          { kind: "fixed", key: "customer_reviews", enabled: false },
          { kind: "fixed", key: "articles", enabled: false },
          { kind: "fixed", key: "faq", enabled: false },
        ]}
        settings={DEFAULT_HOME_SETTINGS}
      />,
    );

    expect(markup.indexOf("<section")).toBeLessThan(
      markup.indexOf('id="contact"'),
    );
  });

  it("keeps the homepage client settings payload limited to rendered fields", () => {
    const settings = toHomePageSettings(
      DEFAULT_SITE_SETTINGS,
      DEFAULT_SITE_CONTACT_SETTINGS,
    );

    expect(Object.keys(settings).sort()).toEqual([
      "bank",
      "contact",
      "heroImage",
      "heroSlides",
      "siteName",
      "tiktok",
    ]);
    expect(settings.heroImage).toBe(DEFAULT_SITE_SETTINGS.heroImage);
    expect(settings.heroSlides).toBe(DEFAULT_SITE_SETTINGS.heroSlides);
    expect(settings.tiktok).toEqual(DEFAULT_SITE_SETTINGS.tiktok);
    expect(settings.contact).toBe(DEFAULT_SITE_CONTACT_SETTINGS.contact);
    expect(settings.bank).toBe(DEFAULT_SITE_CONTACT_SETTINGS.bank);
    expect(settings).not.toHaveProperty("seo");
    expect(settings).not.toHaveProperty("detailLayout");
    expect(settings).not.toHaveProperty("logoImage");
    expect(settings.siteName).toBe(DEFAULT_SITE_SETTINGS.siteName);
  });

  it("keeps seven unique TikTok videos in the homepage settings payload", () => {
    const settings = toHomePageSettings(
      {
        ...DEFAULT_SITE_SETTINGS,
        tiktok: {
        accountUrl: "https://www.tiktok.com/@baanpoolvilla",
        videos: [
          {
            url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000001",
            videoId: "7370000000000000001",
          },
          {
            url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000001",
            videoId: " 7370000000000000001 ",
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
        ],
        },
      },
      DEFAULT_SITE_CONTACT_SETTINGS,
    );

    expect(settings.tiktok.videos.map((video) => video.videoId)).toEqual([
      "7370000000000000001",
      "7370000000000000002",
      "7370000000000000003",
      "7370000000000000004",
      "7370000000000000005",
      "7370000000000000006",
      "7370000000000000007",
    ]);
  });

  it("surfaces degraded homepage sources as non-visible data attributes", () => {
    const markup = renderToStaticMarkup(
      <HomePage
        initialHomeSections={[homeSection]}
        filterSummary={filterSummary}
        settings={DEFAULT_HOME_SETTINGS}
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

  it("renders TikTok section from settings without server preview props and keeps guide placement after it", () => {
    const markup = renderToStaticMarkup(
      <HomePage
        initialGuides={selectHomeGuideSummaries([makeGuide(1)])}
        initialHomeSections={[homeSection]}
        filterSummary={filterSummary}
        settings={{
          ...DEFAULT_HOME_SETTINGS,
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
    const customerReviewSectionIndex = markup.indexOf(
      "data-home-customer-reviews",
    );
    const guidesSectionIndex = markup.indexOf('data-home-guides="true"');
    expect(tiktokSectionIndex).toBeGreaterThan(-1);
    expect(guidesSectionIndex).toBeGreaterThan(tiktokSectionIndex);
    expect(customerReviewSectionIndex).toBe(-1);

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

  it("renders customer review images after TikTok and before guide articles", () => {
    const markup = renderToStaticMarkup(
      <HomePage
        customerReviews={customerReviews}
        initialGuides={selectHomeGuideSummaries([makeGuide(1)])}
        initialHomeSections={[homeSection]}
        filterSummary={filterSummary}
        settings={{
          ...DEFAULT_HOME_SETTINGS,
          tiktok: {
            accountUrl: "https://www.tiktok.com/@baanpoolvilla",
            videos: [
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000100",
                videoId: "7370000000000000100",
              },
            ],
          },
        }}
      />,
    );

    const tiktokSectionIndex = markup.indexOf("data-home-tiktok");
    const customerReviewSectionIndex = markup.indexOf(
      'data-home-customer-reviews="proof_wall"',
    );
    const guidesSectionIndex = markup.indexOf('data-home-guides="true"');

    expect(tiktokSectionIndex).toBeGreaterThan(-1);
    expect(customerReviewSectionIndex).toBeGreaterThan(tiktokSectionIndex);
    expect(guidesSectionIndex).toBeGreaterThan(customerReviewSectionIndex);
    expect(markup).toContain("Customer chat");
    expect(markup).toContain("Transfer slip");
    expect(markup).not.toContain("customer-reviews/review-1.webp");
    expect(markup).not.toContain("customer-reviews/review-2.webp");
    expect(markup).toContain("data-progressive-image-fallback");
  });

  it("switches to a three-column TikTok grid when more than six videos are visible", () => {
    const markup = renderToStaticMarkup(
      <HomePage
        initialGuides={selectHomeGuideSummaries([makeGuide(1)])}
        initialHomeSections={[homeSection]}
        filterSummary={filterSummary}
        settings={{
          ...DEFAULT_HOME_SETTINGS,
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
              {
                url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000016",
                videoId: "7370000000000000016",
              },
            ],
          },
        }}
      />,
    );

    const posterCount = (markup.match(/data-tiktok-poster/g) ?? []).length;
    const tiktokSectionStart = markup.indexOf("data-home-tiktok");
    const tiktokSectionEnd = markup.indexOf('data-home-guides="true"');
    const tiktokSectionMarkup = markup.slice(tiktokSectionStart, tiktokSectionEnd);

    expect(posterCount).toBe(7);
    expect(tiktokSectionMarkup).toContain('data-tiktok-grid="true"');
    expect(tiktokSectionMarkup).toContain("grid-cols-2");
    expect(tiktokSectionMarkup).toContain("sm:grid-cols-3");
    expect(tiktokSectionMarkup).not.toContain("data-scroll-rail-viewport");
    expect(tiktokSectionMarkup).not.toContain("www.tiktok.com/player/v1");

    expect(markup).toContain("video/7370000000000000010");
    expect(markup).toContain("video/7370000000000000014");
    expect(markup).toContain("video/7370000000000000015");
    expect(markup).toContain("video/7370000000000000016");

    const duplicatePlayerCount = (
      markup.match(/video\/7370000000000000010/g) ?? []
    ).length;

    expect(duplicatePlayerCount).toBe(1);
    expect(markup).toContain("video/7370000000000000015");
  });

  it("limits TikTok rendering to the first 15 normalized videos", () => {
    const videos = Array.from({ length: 16 }, (_, index) => {
      const videoId = `7370000000000000${String(index + 1).padStart(3, "0")}`;

      return {
        url: `https://www.tiktok.com/@baanpoolvillas/video/${videoId}`,
        videoId,
      };
    });
    const markup = renderToStaticMarkup(
      <HomePage
        initialGuides={selectHomeGuideSummaries([makeGuide(1)])}
        initialHomeSections={[homeSection]}
        filterSummary={filterSummary}
        settings={{
          ...DEFAULT_HOME_SETTINGS,
          tiktok: {
            accountUrl: "https://www.tiktok.com/@baanpoolvilla",
            videos,
          },
        }}
      />,
    );

    const posterCount = (markup.match(/data-tiktok-poster/g) ?? []).length;
    expect(posterCount).toBe(15);
    expect(markup).not.toContain("www.tiktok.com/player/v1");

    expect(markup).toContain("video/7370000000000000001");
    expect(markup).not.toContain("video/7370000000000000016");
  });

  it("dedupes TikTok videos by trimmed videoId and renders canonical IDs", () => {
    const markup = renderToStaticMarkup(
      <HomePage
        initialGuides={selectHomeGuideSummaries([makeGuide(1)])}
        initialHomeSections={[homeSection]}
        filterSummary={filterSummary}
        settings={{
          ...DEFAULT_HOME_SETTINGS,
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
        initialGuides={selectHomeGuideSummaries([makeGuide(1)])}
        initialHomeSections={[homeSection]}
        filterSummary={filterSummary}
        settings={{
          ...DEFAULT_HOME_SETTINGS,
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
          settings={DEFAULT_HOME_SETTINGS}
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
