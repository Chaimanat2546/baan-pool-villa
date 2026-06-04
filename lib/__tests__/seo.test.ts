import { afterEach, describe, expect, it } from "vitest";

import { buildHomeJsonLd, buildPageMetadata } from "../seo";
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
});
