import { afterEach, describe, expect, it } from "vitest";

import {
  buildBreadcrumbJsonLd,
  buildHomeJsonLd,
  buildPageMetadata,
  buildSiteSettingsPageMetadata,
} from "../seo";
import { DEFAULT_SITE_SETTINGS } from "../site-settings/defaults";
import type { SiteSettings } from "../site-settings/types";

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
        ogImage: {
          path: "/images/search-cover.jpg",
          url: "/images/search-cover.jpg",
          alt: "Search cover",
        },
      },
      guides: {
        title: "Guides SEO Title",
        description: "Guides SEO Description",
        ogImage: {
          path: "/images/guides-cover.jpg",
          url: "/images/guides-cover.jpg",
          alt: "Guides cover",
        },
      },
    },
    detailLayout: DEFAULT_SITE_SETTINGS.detailLayout,
    tiktok: DEFAULT_SITE_SETTINGS.tiktok,
  };
}

afterEach(() => {
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    return;
  }

  process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe("SEO helpers", () => {
  it("builds page metadata from CMS SEO settings", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";

    const settings = cmsSettings();
    const metadata = buildPageMetadata({
      canonicalPath: "/",
      description: settings.seo.description,
      image: settings.seo.ogImage.url,
      imageAlt: settings.seo.ogImage.alt,
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
  });

  it("lets route-level SEO values override CMS defaults when needed", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";

    const metadata = buildSiteSettingsPageMetadata({
      canonicalPath: "/villas/66",
      description: "Villa-specific description",
      image: "https://example.com/villa-66.jpg",
      imageAlt: "Villa 66 cover",
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
      openGraph: {
        images: [
          {
            url: "https://example.com/images/search-cover.jpg",
            alt: "Search cover",
          },
        ],
      },
    });
  });
});
