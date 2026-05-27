import type { Metadata } from "next";

import type { VillaListing } from "@/lib/villas/types";

export const siteName = "Pool Villas Pattaya";
export const defaultTitle = "Pool Villas Pattaya | บ้านพักพูลวิลล่าพัทยา";
export const defaultDescription =
  "รวมบ้านพักพูลวิลล่าพัทยา บ้านพักสระส่วนตัวสำหรับครอบครัว กลุ่มเพื่อน และทริปปาร์ตี้ เลือกทำเล จำนวนคน ห้องนอน ราคา และดูบ้านพักใกล้ทะเลได้ง่าย";
export const searchDescription =
  "ค้นหาบ้านพักพูลวิลล่าพัทยาด้วยทำเล จำนวนผู้เข้าพัก ห้องนอน ราคา สิ่งอำนวยความสะดวก รหัสบ้าน และการเรียงลำดับที่ต้องการ";
export const defaultOgImage = "/images/BPV-66_Cover-Web.jpg";

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

export function getVillaTitle(villa: VillaListing): string {
  return `พูลวิลล่า ${villa.id} พัทยา`;
}

export function getVillaDescription(villa: VillaListing): string {
  const price = villa.price.toLocaleString("th-TH");

  return [
    `${getVillaTitle(villa)} บ้านพักพูลวิลล่าสระส่วนตัว รองรับ ${villa.people.toLocaleString("th-TH")} คน`,
    `${villa.bedrooms.toLocaleString("th-TH")} ห้องนอน`,
    `${villa.bathrooms.toLocaleString("th-TH")} ห้องน้ำ`,
    `ทำเล ${villa.zoneLabel}`,
    `เริ่มต้น ${price} บาท/คืน`,
  ].join(" | ");
}

export function buildPageMetadata({
  canonicalPath,
  description = defaultDescription,
  image = defaultOgImage,
  title,
}: {
  canonicalPath: string;
  description?: string;
  image?: string | null;
  title: string;
}): Metadata {
  const canonicalUrl = absoluteUrl(canonicalPath);
  const imageUrl = image?.startsWith("http") ? image : absoluteUrl(image ?? defaultOgImage);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName,
      locale: "th_TH",
      type: "website",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
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
