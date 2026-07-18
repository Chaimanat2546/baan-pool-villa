import { describe, expect, it } from "vitest";

import {
  SITE_SEO_PAGE_TYPES,
  buildSiteSeoRows,
  mapSiteSeoRowsToLegacyProjection,
} from "../rows";

describe("site SEO row mapping", () => {
  it("maps all four row shapes regardless of input order", () => {
    expect(
      mapSiteSeoRowsToLegacyProjection([
        { page_type: "villa_detail", settings: { keywords: ["villa"] } },
        {
          page_type: "global",
          settings: {
            title: "Home",
            description: "Home description",
            keywords: ["home"],
            ogImageUrl: "/home.webp",
            ogImageAlt: "Home image",
            businessName: "Baan Pool Villa",
            sameAsUrls: ["https://example.com/social"],
          },
        },
        {
          page_type: "guides",
          settings: {
            title: "Guides",
            description: "Guides description",
            keywords: ["guides"],
            ogImageUrl: "/guides.webp",
            ogImageAlt: "Guides image",
          },
        },
        {
          page_type: "search",
          settings: {
            title: "Search",
            description: "Search description",
            keywords: ["search"],
            ogImageUrl: "/search.webp",
            ogImageAlt: "Search image",
          },
        },
      ]),
    ).toEqual({
      seo_title: "Home",
      seo_description: "Home description",
      seo_keywords: ["home"],
      seo_og_image_url: "/home.webp",
      seo_og_image_alt: "Home image",
      seo_business_name: "Baan Pool Villa",
      seo_same_as_urls: ["https://example.com/social"],
      search_seo_title: "Search",
      search_seo_description: "Search description",
      search_seo_keywords: ["search"],
      search_seo_og_image_url: "/search.webp",
      search_seo_og_image_alt: "Search image",
      guides_seo_title: "Guides",
      guides_seo_description: "Guides description",
      guides_seo_keywords: ["guides"],
      guides_seo_og_image_url: "/guides.webp",
      guides_seo_og_image_alt: "Guides image",
      villa_detail_seo_keywords: ["villa"],
    });
  });

  it("leaves missing rows absent so existing normalization supplies defaults", () => {
    expect(
      mapSiteSeoRowsToLegacyProjection([
        { page_type: "search", settings: { title: "Search" } },
      ]),
    ).toEqual({
      search_seo_title: "Search",
      search_seo_description: undefined,
      search_seo_keywords: undefined,
      search_seo_og_image_url: undefined,
      search_seo_og_image_alt: undefined,
    });
  });

  it("ignores malformed settings and unknown rows", () => {
    expect(
      mapSiteSeoRowsToLegacyProjection([
        { page_type: "global", settings: null },
        { page_type: "search", settings: [] },
        { page_type: "guides", settings: "invalid" },
        { page_type: "villa_detail", settings: 1 },
        { page_type: "other", settings: { title: "Unknown" } },
      ] as never),
    ).toEqual({});
  });

  it("uses the last valid duplicate row", () => {
    expect(
      mapSiteSeoRowsToLegacyProjection([
        { page_type: "global", settings: { title: "First" } },
        { page_type: "global", settings: null },
        { page_type: "global", settings: { title: "Last" } },
      ]),
    ).toMatchObject({ seo_title: "Last" });
  });

  it("builds exactly four bounded rows from the flat persistence payload without mutation", () => {
    const payload = {
      seo_title: "Home",
      seo_description: "Home description",
      seo_keywords: ["home"],
      seo_og_image_url: "/home.webp",
      seo_og_image_alt: "Home image",
      seo_business_name: "Baan Pool Villa",
      seo_same_as_urls: ["https://example.com/social"],
      search_seo_title: "Search",
      search_seo_description: "Search description",
      search_seo_keywords: ["search"],
      search_seo_og_image_url: "/search.webp",
      search_seo_og_image_alt: "Search image",
      guides_seo_title: "Guides",
      guides_seo_description: "Guides description",
      guides_seo_keywords: ["guides"],
      guides_seo_og_image_url: "/guides.webp",
      guides_seo_og_image_alt: "Guides image",
      villa_detail_seo_keywords: ["villa"],
    };
    const snapshot = structuredClone(payload);

    expect(SITE_SEO_PAGE_TYPES).toEqual([
      "global",
      "search",
      "guides",
      "villa_detail",
    ]);
    expect(buildSiteSeoRows(payload)).toEqual([
      {
        page_type: "global",
        settings: {
          title: "Home",
          description: "Home description",
          keywords: ["home"],
          ogImageUrl: "/home.webp",
          ogImageAlt: "Home image",
          businessName: "Baan Pool Villa",
          sameAsUrls: ["https://example.com/social"],
        },
      },
      {
        page_type: "search",
        settings: {
          title: "Search",
          description: "Search description",
          keywords: ["search"],
          ogImageUrl: "/search.webp",
          ogImageAlt: "Search image",
        },
      },
      {
        page_type: "guides",
        settings: {
          title: "Guides",
          description: "Guides description",
          keywords: ["guides"],
          ogImageUrl: "/guides.webp",
          ogImageAlt: "Guides image",
        },
      },
      {
        page_type: "villa_detail",
        settings: { keywords: ["villa"] },
      },
    ]);
    expect(payload).toEqual(snapshot);
  });
});
