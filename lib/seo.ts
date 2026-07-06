import type { Metadata } from "next";

import type { GuidePost } from "@/lib/guides/types";
import type { LegalPage } from "@/lib/legal-pages/types";
import { buildAwsImageUrl } from "@/lib/aws-image-url";
import type { SiteSettings } from "@/lib/site-settings/types";
import type { VillaListing } from "@/lib/villas/types";

export const siteName = "Pool Villas Pattaya";
export const defaultTitle = "Pool Villas Pattaya | บ้านพักพูลวิลล่าพัทยา";
export const defaultDescription =
  "รวมบ้านพักพูลวิลล่าพัทยา บ้านพักสระส่วนตัวสำหรับครอบครัว กลุ่มเพื่อน และทริปปาร์ตี้ เลือกทำเล จำนวนคน ห้องนอน ราคา และดูบ้านพักใกล้ทะเลได้ง่าย";
export const defaultKeywords = [
  "บ้านพักพูลวิลล่า",
  "พูลวิลล่าพัทยา",
  "บ้านพูลวิลล่าพัทยา",
  "บ้านพักพูลวิลล่าพัทยา",
  "บ้านพักสระส่วนตัว",
  "พูลวิลล่าใกล้ทะเล",
  "บ้านพักพัทยา",
  "พูลวิลล่าจอมเทียน",
  "พูลวิลล่าบางแสน",
  "พูลวิลล่าหัวหิน",
];
export const searchTitle = "ค้นหาบ้านพักพูลวิลล่าพัทยา";
export const searchDescription =
  "ค้นหาบ้านพักพูลวิลล่าพัทยาด้วยทำเล จำนวนผู้เข้าพัก ห้องนอน ราคา สิ่งอำนวยความสะดวก รหัสบ้าน และการเรียงลำดับที่ต้องการ";
export const searchKeywords = [
  "ค้นหาพูลวิลล่าพัทยา",
  "ค้นหาบ้านพักพูลวิลล่า",
  "บ้านพักพูลวิลล่าตามราคา",
  "พูลวิลล่าตามจำนวนคน",
  "พูลวิลล่าตามทำเล",
];
export const guidesTitle = "บทความแนะนำบ้านพักพูลวิลล่าพัทยา";
export const guidesDescription =
  "บทความแนะนำบ้านพักพูลวิลล่าพัทยา วิธีเลือกบ้านพัก และการเตรียมตัวก่อนเที่ยว";
export const guidesKeywords = [
  "บทความพูลวิลล่าพัทยา",
  "คู่มือเลือกพูลวิลล่า",
  "แนะนำบ้านพักพูลวิลล่า",
  "เที่ยวพัทยาพักพูลวิลล่า",
];
export const villaDetailBaseKeywords = [
  "รายละเอียดพูลวิลล่าพัทยา",
  "จองพูลวิลล่าพัทยา",
  "บ้านพักพูลวิลล่ารายหลัง",
  "พูลวิลล่าสระส่วนตัว",
];
export const defaultOgImage = "/images/BPV-66_Cover-Web.jpg";
const defaultOgImageAlt = "บ้านพักพูลวิลล่าพัทยาพร้อมสระว่ายน้ำส่วนตัว";
const openGraphImageWidth = 1200;
const openGraphImageHeight = 630;
const productionSiteUrl = "https://www.baanpartypattaya.com";

interface BreadcrumbItem {
  name: string;
  path: string;
}

export function getSiteUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl);

      if (url.protocol === "https:") {
        return new URL(url.origin);
      }
    } catch {
      // Fall through to the local default when the public site URL is invalid.
    }
  }

  return new URL(
    process.env.NODE_ENV === "production"
      ? productionSiteUrl
      : "http://localhost:3000",
  );
}

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, getSiteUrl()).toString();
}

function absoluteHttpUrl(value: string | null | undefined, fallback: string): string {
  const trimmedValue = value?.trim() ?? "";

  if (trimmedValue.length === 0) {
    return absoluteUrl(fallback);
  }

  try {
    const url = new URL(trimmedValue);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    if (trimmedValue.startsWith("/") && !trimmedValue.startsWith("//")) {
      return absoluteUrl(trimmedValue);
    }
  }

  return absoluteUrl(fallback);
}

function buildAbsoluteMetadataImageUrl(
  image: string | null | undefined,
  fallback: string = defaultOgImage,
): string {
  return buildMetadataImageUrl(image, { fallback });
}

function buildSiteAssetMetadataImageUrl(
  image: string | null | undefined,
): string | null {
  return image ? buildMetadataImageUrl(image) : null;
}

export function buildMetadataImageUrl(
  image: string | null | undefined,
  {
    fallback = defaultOgImage,
    quality = 75,
    width = 1200,
  }: { fallback?: string; quality?: number; width?: number } = {},
): string {
  const candidate = image?.trim() || fallback;

  try {
    return absoluteHttpUrl(
      buildAwsImageUrl({ quality, src: candidate, width }),
      fallback,
    );
  } catch {
    return absoluteHttpUrl(candidate, fallback);
  }
}

export function getVillaTitle(villa: VillaListing): string {
  const customTitle = villa.title?.trim();

  if (customTitle) {
    return customTitle;
  }

  const zoneLabel = villa.zoneLabel.trim();
  const titleLocation = zoneLabel.includes("พัทยา")
    ? zoneLabel
    : `${zoneLabel} พัทยา`;

  return `พูลวิลล่า ${villa.id} ${titleLocation}`;
}

function uniqueKeywords(keywords: string[]): string[] {
  return [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))];
}

export function getVillaDescription(villa: VillaListing): string {
  const price = villa.price?.toLocaleString("th-TH") ?? "";

  return [
    `${getVillaTitle(villa)} บ้านพักพูลวิลล่าสระส่วนตัว รองรับ ${villa.people.toLocaleString("th-TH")} คน`,
    `${villa.bedrooms.toLocaleString("th-TH")} ห้องนอน`,
    `${villa.bathrooms.toLocaleString("th-TH")} ห้องน้ำ`,
    `ใกล้ทะเล ${villa.distanceToSea}`,
    `เริ่มต้น ${price} บาท/คืน`,
  ].join(" | ");
}

export function getVillaSearchIntentSummary(villa: VillaListing): string {
  return [
    `${getVillaTitle(villa)} เหมาะสำหรับกลุ่มที่ต้องการบ้านพักพัทยาพร้อมสระส่วนตัว`,
    `รองรับ ${villa.people.toLocaleString("th-TH")} คน`,
    `${villa.bedrooms.toLocaleString("th-TH")} ห้องนอน`,
    `ทำเล ${villa.zoneLabel}`,
    `ราคาเริ่มต้น ${villa.price?.toLocaleString("th-TH") ?? ""} บาทต่อคืน`,
  ].join(" ");
}

export function getVillaKeywords(villa: VillaListing): string[] {
  const zoneLabel = villa.zoneLabel.trim();
  const titleLocation = zoneLabel.includes("พัทยา")
    ? zoneLabel
    : `${zoneLabel} พัทยา`;

  return uniqueKeywords([
    `พูลวิลล่า ${villa.id}`,
    `บ้านพัก ${villa.id}`,
    `พูลวิลล่า ${zoneLabel}`,
    `บ้านพัก ${titleLocation}`,
    `พูลวิลล่า ${villa.people.toLocaleString("th-TH")} คน`,
    `พูลวิลล่า ${villa.bedrooms.toLocaleString("th-TH")} ห้องนอน`,
    `พูลวิลล่าใกล้ทะเล ${villa.distanceToSea}`,
    ...villa.amenities.map((amenity) => `พูลวิลล่า${amenity.label}`),
  ]);
}

export function buildPageMetadata({
  absoluteTitle = false,
  canonicalPath,
  description = defaultDescription,
  image = defaultOgImage,
  imageAlt,
  keywords = defaultKeywords,
  openGraphType = "website",
  publishedTime,
  siteName: metadataSiteName = siteName,
  title,
}: {
  absoluteTitle?: boolean;
  canonicalPath: string;
  description?: string;
  image?: string | null;
  imageAlt?: string;
  keywords?: string[];
  openGraphType?: "article" | "website";
  publishedTime?: string | null;
  siteName?: string;
  title: string;
}): Metadata {
  const canonicalUrl = absoluteUrl(canonicalPath);
  const imageUrl = buildAbsoluteMetadataImageUrl(image);
  const openGraphImageAlt = imageAlt?.trim() || defaultOgImageAlt;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    keywords: uniqueKeywords(keywords),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: metadataSiteName,
      locale: "th_TH",
      type: openGraphType,
      ...(openGraphType === "article" && publishedTime
        ? { publishedTime }
        : {}),
      images: [
        {
          url: imageUrl,
          width: openGraphImageWidth,
          height: openGraphImageHeight,
          alt: openGraphImageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export function buildGlobalMetadata(): Metadata {
  return {
    ...buildPageMetadata({
      canonicalPath: "/",
      description: defaultDescription,
      imageAlt: defaultOgImageAlt,
      title: defaultTitle,
    }),
    applicationName: siteName,
    metadataBase: getSiteUrl(),
    robots: {
      follow: true,
      index: true,
    },
    title: {
      default: defaultTitle,
      template: `%s | ${siteName}`,
    },
  };
}

function getIconContentType(iconUrl: string): string | undefined {
  const pathname = (() => {
    try {
      return new URL(iconUrl, getSiteUrl()).pathname;
    } catch {
      return iconUrl;
    }
  })().toLowerCase();

  if (pathname.endsWith(".png")) {
    return "image/png";
  }

  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (pathname.endsWith(".webp")) {
    return "image/webp";
  }

  if (pathname.endsWith(".ico")) {
    return "image/x-icon";
  }

  return undefined;
}

export function buildSiteSettingsGlobalMetadata(
  settings: SiteSettings,
): Metadata {
  const faviconUrl = settings.faviconImage.url;
  const faviconType = getIconContentType(faviconUrl);

  return {
    ...buildSiteSettingsPageMetadata({
      absoluteTitle: true,
      canonicalPath: "/",
      settings,
      title: settings.seo.title,
    }),
    applicationName: settings.siteName,
    icons: {
      icon: [
        {
          url: faviconUrl,
          ...(faviconType ? { type: faviconType } : {}),
        },
      ],
      apple: [
        {
          url: faviconUrl,
          ...(faviconType ? { type: faviconType } : {}),
        },
      ],
    },
    metadataBase: getSiteUrl(),
    robots: {
      follow: true,
      index: true,
    },
    title: {
      default: settings.seo.title,
      template: `%s | ${settings.siteName}`,
    },
  };
}

export function buildSiteSettingsPageMetadata({
  absoluteTitle = false,
  canonicalPath,
  description,
  image,
  imageAlt,
  keywords,
  openGraphType,
  publishedTime,
  section,
  settings,
  title,
}: {
  absoluteTitle?: boolean;
  canonicalPath: string;
  description?: string;
  image?: string | null;
  imageAlt?: string;
  keywords?: string[];
  openGraphType?: "article" | "website";
  publishedTime?: string | null;
  section?: Exclude<keyof SiteSettings["pageSeo"], "villaDetail">;
  settings: SiteSettings;
  title?: string;
}): Metadata {
  const sectionSeo = section ? settings.pageSeo[section] : null;
  const resolvedTitle = title ?? sectionSeo?.title ?? settings.seo.title;
  const resolvedKeywords = keywords ??
    (sectionSeo && "keywords" in sectionSeo && sectionSeo.keywords.length > 0
      ? sectionSeo.keywords
      : settings.seo.keywords);
  const settingsImage = sectionSeo?.ogImage.url ?? settings.seo.ogImage.url;
  const resolvedImage = image ?? buildSiteAssetMetadataImageUrl(settingsImage);

  return buildPageMetadata({
    absoluteTitle,
    canonicalPath,
    description: description ?? sectionSeo?.description ?? settings.seo.description,
    image: resolvedImage,
    imageAlt: imageAlt ?? sectionSeo?.ogImage.alt ?? settings.seo.ogImage.alt,
    keywords: resolvedKeywords,
    openGraphType,
    publishedTime,
    siteName: settings.seo.businessName,
    title: resolvedTitle,
  });
}

export function buildGuideArticleMetadata({
  guide,
  settings,
}: {
  guide: GuidePost;
  settings: SiteSettings;
}): Metadata {
  return buildSiteSettingsPageMetadata({
    canonicalPath: `/guides/${guide.slug}`,
    description: guide.excerpt,
    image: guide.coverImage?.url ? buildMetadataImageUrl(guide.coverImage.url) : null,
    imageAlt: guide.coverImage?.alt ?? guide.title,
    openGraphType: "article",
    publishedTime: guide.publishedAt ?? guide.createdAt,
    settings,
    title: guide.title,
  });
}

export function buildLegalPageMetadata({
  page,
  settings,
}: {
  page: LegalPage;
  settings: SiteSettings;
}): Metadata {
  return buildSiteSettingsPageMetadata({
    canonicalPath: `/${page.slug}`,
    description: page.seoDescription || settings.seo.description,
    settings,
    title: page.title,
  });
}

export function buildVillaDetailMetadata({
  settings,
  villa,
}: {
  settings: SiteSettings;
  villa: VillaListing;
}): Metadata {
  return buildSiteSettingsPageMetadata({
    canonicalPath: `/villas/${villa.id}`,
    description: getVillaDescription(villa),
    image: villa.coverImage ? buildMetadataImageUrl(villa.coverImage) : null,
    imageAlt: getVillaTitle(villa),
    keywords: uniqueKeywords([
      ...(settings.pageSeo.villaDetail.keywords.length > 0
        ? settings.pageSeo.villaDetail.keywords
        : settings.seo.keywords),
      ...getVillaKeywords(villa),
    ]),
    settings,
    title: getVillaTitle(villa),
  });
}

export function buildBreadcrumbJsonLd(
  items: BreadcrumbItem[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildHomeJsonLd(settings: SiteSettings): Record<string, unknown> {
  const firstPhone = settings.contact.phoneContacts.at(0)?.phone;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: settings.seo.businessName,
    description: settings.seo.description,
    image: buildAbsoluteMetadataImageUrl(
      buildSiteAssetMetadataImageUrl(settings.seo.ogImage.url),
    ),
    url: absoluteUrl("/"),
    areaServed: ["พัทยา", "จอมเทียน", "บางแสน", "หัวหิน"],
    amenityFeature: [
      { "@type": "LocationFeatureSpecification", name: "สระว่ายน้ำส่วนตัว" },
      { "@type": "LocationFeatureSpecification", name: "บ้านพักสำหรับกลุ่ม" },
      { "@type": "LocationFeatureSpecification", name: "บ้านพักใกล้ทะเล" },
    ],
  };

  if (firstPhone) {
    jsonLd.telephone = firstPhone;
  }

  if (settings.seo.sameAsUrls.length > 0) {
    jsonLd.sameAs = settings.seo.sameAsUrls;
  }

  return jsonLd;
}
