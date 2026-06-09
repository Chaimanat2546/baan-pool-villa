import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VillaDetailPage } from "@/components/villas/detail/page";
import { serializeJsonLd } from "@/lib/json-ld";
import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildSiteSettingsPageMetadata,
  getVillaDescription,
  getVillaTitle,
} from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings/server";
import { fetchVillaPageData, getListingById } from "@/lib/villas/server";

interface VillaPageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 43200;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: VillaPageProps): Promise<Metadata> {
  const { id } = await params;
  const [listing, siteSettingsResult] = await Promise.all([
    getListingById(id),
    getSiteSettings(),
  ]);
  const { settings } = siteSettingsResult;

  if (!listing) {
    return buildSiteSettingsPageMetadata({
      canonicalPath: `/villas/${id}`,
      description: "ไม่พบข้อมูลบ้านพักพูลวิลล่าที่คุณกำลังค้นหา",
      settings,
      title: "ไม่พบข้อมูลบ้านพัก",
    });
  }

  return buildSiteSettingsPageMetadata({
    canonicalPath: `/villas/${listing.id}`,
    description: getVillaDescription(listing),
    image: listing.coverImage,
    settings,
    title: getVillaTitle(listing),
  });
}

export default async function Page({ params }: VillaPageProps) {
  const { id } = await params;
  const [data, siteSettingsResult] = await Promise.all([
    fetchVillaPageData(id),
    getSiteSettings(),
  ]);

  if (!data) {
    notFound();
  }

  const listing = data.payload.listing;
  const jsonLd = [
    buildBreadcrumbJsonLd([
      { name: "หน้าแรก", path: "/" },
      { name: "ค้นหาบ้านพัก", path: "/search" },
      { name: getVillaTitle(listing), path: `/villas/${listing.id}` },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "VacationRental",
      name: getVillaTitle(listing),
      description: getVillaDescription(listing),
      image: listing.coverImage ? [listing.coverImage] : undefined,
      url: absoluteUrl(`/villas/${listing.id}`),
      address: {
        "@type": "PostalAddress",
        addressLocality: listing.zoneLabel,
        addressRegion: "ชลบุรี",
        addressCountry: "TH",
      },
      occupancy: {
        "@type": "QuantitativeValue",
        value: listing.people,
      },
      numberOfBedrooms: listing.bedrooms,
      numberOfBathroomsTotal: listing.bathrooms,
      amenityFeature: listing.amenities.map((amenity) => ({
        "@type": "LocationFeatureSpecification",
        name: amenity.label,
      })),
      priceRange: `เริ่มต้น ${listing.price.toLocaleString("th-TH")} บาท/คืน`,
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <VillaDetailPage
        id={id}
        payload={data.payload}
        recommendedVillas={data.recommendedVillas}
        settings={siteSettingsResult.settings}
      />
    </>
  );
}
