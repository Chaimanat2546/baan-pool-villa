import { afterEach, describe, expect, it } from "vitest";

import {
  buildBreadcrumbJsonLd,
  buildGlobalMetadata,
  buildGuideArticleMetadata,
  buildHomeJsonLd,
  buildPageMetadata,
  buildLegalPageMetadata,
  buildSiteSettingsPageMetadata,
  buildVillaDetailMetadata,
  getSiteUrl,
  getVillaDescription,
  getVillaKeywords,
  getVillaSearchIntentSummary,
  getVillaTitle,
} from "../seo";
import { DEFAULT_SITE_SETTINGS } from "../site-settings/defaults";
import type { SiteSettings } from "../site-settings/types";
import type { GuidePost } from "../guides/types";
import type { LegalPage } from "../legal-pages/types";
import type { VillaListing } from "../villas/types";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

function cmsSettings(): SiteSettings {
  return {
    siteName: "Baan Pool Villa",
    primaryColor: "#064e3b",
    accentColor: "#eab308",
    logoImage: {
      path: "/images/logo.jpg",
      url: "/images/logo.jpg",
      alt: "Logo",
    },
    heroImage: {
      path: "/images/hero.jpg",
      url: "/images/hero.jpg",
      alt: "Hero",
    },
    bank: {
      accountName: "Account Name",
      bankName: "Bank Name",
      accountNumber: "398-289-7482",
    },
    contact: {
      phoneContacts: [
        {
          name: "Game",
          phone: "0617485213",
          time: "07.00-15.00",
        },
      ],
      messengerUrl: "https://www.facebook.com/baanpoolvillas",
      lineId: "@baanpoolvilla",
      lineUrl: "https://line.me/R/ti/p/@baanpoolvilla",
    },
    seo: {
      title: "Baan Pool Villa Pattaya | Private Pool Villas",
      description: "Book private pool villas in Pattaya.",
      keywords: ["global pool villa", "pattaya private villa"],
      ogImage: {
        path: "/images/seo-cover.jpg",
        url: "/images/seo-cover.jpg",
        alt: "Pool villa with private swimming pool",
      },
      businessName: "Baan Pool Villa Pattaya",
      sameAsUrls: [
        "https://www.facebook.com/baanpoolvillas",
        "https://line.me/R/ti/p/@baanpoolvilla",
      ],
    },
    pageSeo: {
      search: {
        title: "Search SEO Title",
        description: "Search SEO Description",
        keywords: ["search pool villa", "filter villa by guests"],
        ogImage: {
          path: "/images/search-cover.jpg",
          url: "/images/search-cover.jpg",
          alt: "Search cover",
        },
      },
      guides: {
        title: "Guides SEO Title",
        description: "Guides SEO Description",
        keywords: ["pool villa guide", "pattaya trip planning"],
        ogImage: {
          path: "/images/guides-cover.jpg",
          url: "/images/guides-cover.jpg",
          alt: "Guides cover",
        },
      },
      villaDetail: {
        keywords: ["villa detail base", "book private villa"],
      },
    },
    detailLayout: DEFAULT_SITE_SETTINGS.detailLayout,
    tiktok: DEFAULT_SITE_SETTINGS.tiktok,
  };
}

const sampleVilla: VillaListing = {
  amenities: [
    { key: "wifi", label: "Wi-Fi" },
    { key: "grill", label: "เตาปิ้งย่าง" },
  ],
  bathrooms: 4,
  bedrooms: 5,
  coverImage: "https://devillegroups.com/imgs/profile_imgs_large/901.jpg",
  distanceToSea: "500m",
  id: "901",
  people: 12,
  poolType: "private",
  price: 12000,
  zone: "jomtien",
  zoneLabel: "Jomtien",
};

const sampleVillaCoverProxyUrl =
  "https://example.com/api/houses/images/901?w=1200&q=75";

const sampleGuide: GuidePost = {
  contentBlocks: [],
  coverImage: {
    alt: "Family choosing Pattaya pool villa",
    path: "/guides/family-cover.jpg",
    url: "/guides/family-cover.jpg",
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  excerpt: "วิธีเลือกพูลวิลล่าพัทยาสำหรับครอบครัวและกลุ่มเพื่อน",
  id: "guide-1",
  isPinned: true,
  publishedAt: "2026-01-05T00:00:00.000Z",
  recommendedHouseIds: ["901"],
  slug: "choose-pattaya-pool-villa",
  status: "published",
  tags: ["พูลวิลล่าพัทยา"],
  title: "เลือกพูลวิลล่าพัทยาให้เหมาะกับทริป",
  updatedAt: "2026-01-08T00:00:00.000Z",
};

const sampleLegalPage: LegalPage = {
  contentBlocks: [
    { type: "heading", content: [{ text: "Terms of Service" }] },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  id: "legal-terms-1",
  publishedAt: "2026-01-01T00:00:00.000Z",
  seoDescription: "Terms of service and policy information.",
  slug: "terms",
  status: "published",
  title: "Terms and Conditions",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

afterEach(() => {
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    return;
  }

  process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe("SEO helpers", () => {
  it("falls back to localhost when NEXT_PUBLIC_SITE_URL is invalid", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "not a url";

    expect(getSiteUrl()).toEqual(new URL("http://localhost:3000"));
  });

  it("falls back to localhost when NEXT_PUBLIC_SITE_URL is not https", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://example.com";

    expect(getSiteUrl()).toEqual(new URL("http://localhost:3000"));
  });

  it("uses only the https origin from NEXT_PUBLIC_SITE_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com/path?q=1";

    expect(getSiteUrl()).toEqual(new URL("https://example.com"));
  });

  it("builds the global public metadata baseline", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";

    const metadata = buildGlobalMetadata();

    expect(metadata).toMatchObject({
      applicationName: "Pool Villas Pattaya",
      alternates: {
        canonical: "https://example.com/",
      },
      description: expect.any(String),
      metadataBase: new URL("https://example.com"),
      openGraph: {
        description: expect.any(String),
        images: [
          {
            alt: "บ้านพักพูลวิลล่าพัทยาพร้อมสระว่ายน้ำส่วนตัว",
            height: 630,
            url: "https://example.com/images/BPV-66_Cover-Web.jpg",
            width: 1200,
          },
        ],
        locale: "th_TH",
        siteName: "Pool Villas Pattaya",
        title: expect.any(String),
        type: "website",
        url: "https://example.com/",
      },
      robots: {
        follow: true,
        index: true,
      },
      title: {
        default: expect.any(String),
        template: "%s | Pool Villas Pattaya",
      },
      twitter: {
        card: "summary_large_image",
        description: expect.any(String),
        images: ["https://example.com/images/BPV-66_Cover-Web.jpg"],
        title: expect.any(String),
      },
    });
  });

  it("builds page metadata from CMS SEO settings", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";

    const settings = cmsSettings();
    const metadata = buildPageMetadata({
      canonicalPath: "/",
      description: settings.seo.description,
      image: settings.seo.ogImage.url,
      imageAlt: settings.seo.ogImage.alt,
      keywords: settings.seo.keywords,
      siteName: settings.seo.businessName,
      title: settings.seo.title,
    });

    expect(metadata).toMatchObject({
      title: "Baan Pool Villa Pattaya | Private Pool Villas",
      description: "Book private pool villas in Pattaya.",
      alternates: {
        canonical: "https://example.com/",
      },
      openGraph: {
        siteName: "Baan Pool Villa Pattaya",
        images: [
          {
            url: "https://example.com/images/seo-cover.jpg",
            alt: "Pool villa with private swimming pool",
          },
        ],
      },
    });
    expect(metadata.keywords).toEqual([
      "global pool villa",
      "pattaya private villa",
    ]);
  });

  it("can build an absolute page title without inheriting the root template", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";

    const metadata = buildPageMetadata({
      absoluteTitle: true,
      canonicalPath: "/",
      title: "Homepage SEO Title",
    });

    expect(metadata.title).toEqual({
      absolute: "Homepage SEO Title",
    });
  });

  it("builds LodgingBusiness JSON-LD from CMS SEO and contact settings", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";

    expect(buildHomeJsonLd(cmsSettings())).toMatchObject({
      "@context": "https://schema.org",
      "@type": "LodgingBusiness",
      name: "Baan Pool Villa Pattaya",
      description: "Book private pool villas in Pattaya.",
      image: "https://example.com/images/seo-cover.jpg",
      url: "https://example.com/",
      telephone: "0617485213",
      sameAs: [
        "https://www.facebook.com/baanpoolvillas",
        "https://line.me/R/ti/p/@baanpoolvilla",
      ],
      areaServed: ["พัทยา", "จอมเทียน", "บางแสน", "หัวหิน"],
      amenityFeature: [
        { "@type": "LocationFeatureSpecification", name: "สระว่ายน้ำส่วนตัว" },
        { "@type": "LocationFeatureSpecification", name: "บ้านพักสำหรับกลุ่ม" },
        { "@type": "LocationFeatureSpecification", name: "บ้านพักใกล้ทะเล" },
      ],
    });
  });

  it("builds breadcrumb JSON-LD with canonical item URLs", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";

    expect(
      buildBreadcrumbJsonLd([
        { name: "หน้าแรก", path: "/" },
        { name: "บทความ", path: "/guides" },
        { name: "คู่มือเที่ยวพัทยา", path: "/guides/pattaya-guide" },
      ]),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "หน้าแรก",
          item: "https://example.com/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "บทความ",
          item: "https://example.com/guides",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "คู่มือเที่ยวพัทยา",
          item: "https://example.com/guides/pattaya-guide",
        },
      ],
    });
  });

  it("uses CMS SEO settings as public metadata defaults", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";

    const metadata = buildSiteSettingsPageMetadata({
      canonicalPath: "/guides",
      settings: cmsSettings(),
      title: "บทความแนะนำบ้านพักพูลวิลล่าพัทยา",
    });

    expect(metadata).toMatchObject({
      title: "บทความแนะนำบ้านพักพูลวิลล่าพัทยา",
      description: "Book private pool villas in Pattaya.",
      alternates: {
        canonical: "https://example.com/guides",
      },
      openGraph: {
        siteName: "Baan Pool Villa Pattaya",
        images: [
          {
            url: "https://example.com/images/seo-cover.jpg",
            alt: "Pool villa with private swimming pool",
          },
        ],
      },
      twitter: {
        images: ["https://example.com/images/seo-cover.jpg"],
      },
    });
    expect(metadata.keywords).toEqual([
      "global pool villa",
      "pattaya private villa",
    ]);
  });

  it("routes absolute CMS SEO images through the site asset proxy", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    const settings = cmsSettings();
    settings.seo.ogImage.url =
      "https://assets.example.com/storage/v1/object/public/site-assets/seo-cover.jpg";

    const metadata = buildSiteSettingsPageMetadata({
      canonicalPath: "/",
      settings,
      title: settings.seo.title,
    });
    const expectedImageUrl =
      "https://example.com/api/site-assets/proxy?url=https%3A%2F%2Fassets.example.com%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fsite-assets%2Fseo-cover.jpg&w=1200&q=75";

    expect(metadata).toMatchObject({
      openGraph: {
        images: [
          {
            url: expectedImageUrl,
          },
        ],
      },
      twitter: {
        images: [expectedImageUrl],
      },
    });
  });

  it("lets route-level SEO values override CMS defaults when needed", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";

    const metadata = buildSiteSettingsPageMetadata({
      canonicalPath: "/villas/66",
      description: "Villa-specific description",
      image: "https://example.com/villa-66.jpg",
      imageAlt: "Villa 66 cover",
      keywords: ["route keyword", "global pool villa"],
      settings: cmsSettings(),
      title: "พูลวิลล่า 66 พัทยา",
    });

    expect(metadata).toMatchObject({
      title: "พูลวิลล่า 66 พัทยา",
      description: "Villa-specific description",
      openGraph: {
        siteName: "Baan Pool Villa Pattaya",
        images: [
          {
            url: "https://example.com/villa-66.jpg",
            alt: "Villa 66 cover",
          },
        ],
      },
      twitter: {
        images: ["https://example.com/villa-66.jpg"],
      },
    });
    expect(metadata.keywords).toEqual(["route keyword", "global pool villa"]);
  });

  it("uses section SEO templates when a public page requests them", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";

    const metadata = buildSiteSettingsPageMetadata({
      canonicalPath: "/search",
      section: "search",
      settings: cmsSettings(),
    });

    expect(metadata).toMatchObject({
      title: "Search SEO Title",
      description: "Search SEO Description",
      alternates: {
        canonical: "https://example.com/search",
      },
      openGraph: {
        description: "Search SEO Description",
        title: "Search SEO Title",
        type: "website",
        url: "https://example.com/search",
        images: [
          {
            url: "https://example.com/images/search-cover.jpg",
            alt: "Search cover",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        description: "Search SEO Description",
        images: ["https://example.com/images/search-cover.jpg"],
        title: "Search SEO Title",
      },
    });
    expect(metadata.keywords).toEqual([
      "search pool villa",
      "filter villa by guests",
    ]);
  });

  it("builds consistent article metadata for guide detail pages", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";

    const metadata = buildGuideArticleMetadata({
      guide: sampleGuide,
      settings: cmsSettings(),
    });

    expect(metadata).toMatchObject({
      title: "เลือกพูลวิลล่าพัทยาให้เหมาะกับทริป",
      description: "วิธีเลือกพูลวิลล่าพัทยาสำหรับครอบครัวและกลุ่มเพื่อน",
      alternates: {
        canonical: "https://example.com/guides/choose-pattaya-pool-villa",
      },
      openGraph: {
        description: "วิธีเลือกพูลวิลล่าพัทยาสำหรับครอบครัวและกลุ่มเพื่อน",
        images: [
          {
            alt: "Family choosing Pattaya pool villa",
            url: "https://example.com/api/guides/images/choose-pattaya-pool-villa/cover?w=1200&q=75",
          },
        ],
        publishedTime: "2026-01-05T00:00:00.000Z",
        title: "เลือกพูลวิลล่าพัทยาให้เหมาะกับทริป",
        type: "article",
        url: "https://example.com/guides/choose-pattaya-pool-villa",
      },
      twitter: {
        card: "summary_large_image",
        description: "วิธีเลือกพูลวิลล่าพัทยาสำหรับครอบครัวและกลุ่มเพื่อน",
        images: [
          "https://example.com/api/guides/images/choose-pattaya-pool-villa/cover?w=1200&q=75",
        ],
        title: "เลือกพูลวิลล่าพัทยาให้เหมาะกับทริป",
      },
    });
  });

  it("builds metadata for legal pages", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";

    const metadata = buildLegalPageMetadata({
      page: sampleLegalPage,
      settings: cmsSettings(),
    });

    expect(metadata).toMatchObject({
      title: "Terms and Conditions",
      description: "Terms of service and policy information.",
      alternates: {
        canonical: "https://example.com/terms",
      },
      openGraph: {
        title: "Terms and Conditions",
        description: "Terms of service and policy information.",
        type: "website",
        url: "https://example.com/terms",
      },
    });
  });

  it("builds long-tail villa metadata from listing data", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";

    const metadata = buildVillaDetailMetadata({
      settings: cmsSettings(),
      villa: sampleVilla,
    });

    expect(getVillaTitle(sampleVilla)).toBe("พูลวิลล่า 901 Jomtien พัทยา");
    expect(getVillaDescription(sampleVilla)).toContain("รองรับ 12 คน");
    expect(getVillaDescription(sampleVilla)).toContain("5 ห้องนอน");
    expect(getVillaDescription(sampleVilla)).toContain("ใกล้ทะเล 500m");
    expect(getVillaSearchIntentSummary(sampleVilla)).toContain(
      "ราคาเริ่มต้น 12,000 บาทต่อคืน",
    );
    expect(metadata).toMatchObject({
      title: "พูลวิลล่า 901 Jomtien พัทยา",
      description:
        "พูลวิลล่า 901 Jomtien พัทยา บ้านพักพูลวิลล่าสระส่วนตัว รองรับ 12 คน | 5 ห้องนอน | 4 ห้องน้ำ | ใกล้ทะเล 500m | เริ่มต้น 12,000 บาท/คืน",
      alternates: {
        canonical: "https://example.com/villas/901",
      },
      openGraph: {
        description:
          "พูลวิลล่า 901 Jomtien พัทยา บ้านพักพูลวิลล่าสระส่วนตัว รองรับ 12 คน | 5 ห้องนอน | 4 ห้องน้ำ | ใกล้ทะเล 500m | เริ่มต้น 12,000 บาท/คืน",
        images: [
          {
            alt: "พูลวิลล่า 901 Jomtien พัทยา",
            url: sampleVillaCoverProxyUrl,
          },
        ],
        title: "พูลวิลล่า 901 Jomtien พัทยา",
        type: "website",
        url: "https://example.com/villas/901",
      },
      twitter: {
        card: "summary_large_image",
        description:
          "พูลวิลล่า 901 Jomtien พัทยา บ้านพักพูลวิลล่าสระส่วนตัว รองรับ 12 คน | 5 ห้องนอน | 4 ห้องน้ำ | ใกล้ทะเล 500m | เริ่มต้น 12,000 บาท/คืน",
        images: [sampleVillaCoverProxyUrl],
        title: "พูลวิลล่า 901 Jomtien พัทยา",
      },
    });
    expect(metadata.keywords).toEqual(
      expect.arrayContaining([
        "villa detail base",
        "book private villa",
        ...getVillaKeywords(sampleVilla),
      ]),
    );
  });
});
