import type { Metadata } from "next";

import type { GuidePost } from "@/lib/guides/types";
import type { SiteSettings } from "@/lib/site-settings/types";
import type { VillaListing } from "@/lib/villas/types";

export const siteName = "Pool Villas Pattaya";
export const defaultTitle = "Pool Villas Pattaya | บ้านพักพูลวิลล่าพัทยา";
export const defaultDescription =
  "รวมบ้านพักพูลวิลล่าพัทยา บ้านพักสระส่วนตัวสำหรับครอบครัว กลุ่มเพื่อน และทริปปาร์ตี้ เลือกทำเล จำนวนคน ห้องนอน ราคา และดูบ้านพักใกล้ทะเลได้ง่าย";
export const searchTitle = "ค้นหาบ้านพักพูลวิลล่าพัทยา";
export const searchDescription =
  "ค้นหาบ้านพักพูลวิลล่าพัทยาด้วยทำเล จำนวนผู้เข้าพัก ห้องนอน ราคา สิ่งอำนวยความสะดวก รหัสบ้าน และการเรียงลำดับที่ต้องการ";
export const guidesTitle = "บทความแนะนำบ้านพักพูลวิลล่าพัทยา";
export const guidesDescription =
  "บทความแนะนำบ้านพักพูลวิลล่าพัทยา วิธีเลือกบ้านพัก และการเตรียมตัวก่อนเที่ยว";
export const defaultOgImage = "/images/BPV-66_Cover-Web.jpg";
const defaultOgImageAlt = "บ้านพักพูลวิลล่าพัทยาพร้อมสระว่ายน้ำส่วนตัว";
const openGraphImageWidth = 1200;
const openGraphImageHeight = 630;

interface BreadcrumbItem {
  name: string;
  path: string;
}

export function getSiteUrl(): URL {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000";
  const url =
    configuredUrl.startsWith("http://") || configuredUrl.startsWith("https://")
      ? configuredUrl
      : `https://${configuredUrl}`;

  return new URL(url);
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

export function getVillaTitle(villa: VillaListing): string {
  const zoneLabel = villa.zoneLabel.trim();
  const titleLocation = zoneLabel.includes("พัทยา")
    ? zoneLabel
    : `${zoneLabel} พัทยา`;

  return `พูลวิลล่า ${villa.id} ${titleLocation}`;
}

export function getVillaDescription(villa: VillaListing): string {
  const price = villa.price.toLocaleString("th-TH");

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
    `ราคาเริ่มต้น ${villa.price.toLocaleString("th-TH")} บาทต่อคืน`,
  ].join(" ");
}

export function buildPageMetadata({
  absoluteTitle = false,
  canonicalPath,
  description = defaultDescription,
  image = defaultOgImage,
  imageAlt,
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
  openGraphType?: "article" | "website";
  publishedTime?: string | null;
  siteName?: string;
  title: string;
}): Metadata {
  const canonicalUrl = absoluteUrl(canonicalPath);
  const imageUrl = absoluteHttpUrl(image, defaultOgImage);
  const openGraphImageAlt = imageAlt?.trim() || defaultOgImageAlt;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
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

export function buildSiteSettingsPageMetadata({
  absoluteTitle = false,
  canonicalPath,
  description,
  image,
  imageAlt,
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
  openGraphType?: "article" | "website";
  publishedTime?: string | null;
  section?: keyof SiteSettings["pageSeo"];
  settings: SiteSettings;
  title?: string;
}): Metadata {
  const sectionSeo = section ? settings.pageSeo[section] : null;
  const resolvedTitle = title ?? sectionSeo?.title ?? settings.seo.title;

  return buildPageMetadata({
    absoluteTitle,
    canonicalPath,
    description: description ?? sectionSeo?.description ?? settings.seo.description,
    image: image ?? sectionSeo?.ogImage.url ?? settings.seo.ogImage.url,
    imageAlt: imageAlt ?? sectionSeo?.ogImage.alt ?? settings.seo.ogImage.alt,
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
    image: guide.coverImage?.url,
    imageAlt: guide.coverImage?.alt ?? guide.title,
    openGraphType: "article",
    publishedTime: guide.publishedAt ?? guide.createdAt,
    settings,
    title: guide.title,
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
    image: villa.coverImage,
    imageAlt: getVillaTitle(villa),
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
    image: absoluteHttpUrl(settings.seo.ogImage.url, defaultOgImage),
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
