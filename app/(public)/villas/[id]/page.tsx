import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VillaDetailPage } from "@/components/villas/detail/page";
import { hasEnabledDetailLayoutBlock } from "@/components/villas/detail/detail-page-helpers";
import { getActiveAdvertisements } from "@/lib/advertisements/server";
import type { PublicAdvertisement } from "@/lib/advertisements/types";
import type { AnyDetailLayoutConfig } from "@/lib/detail-layout/types";
import { serializeJsonLd } from "@/lib/json-ld";
import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildMetadataImageUrl,
  buildSiteSettingsPageMetadata,
  buildVillaDetailMetadata,
  getVillaSearchIntentSummary,
  getVillaTitle,
} from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings/server";
import { fetchVillaPageData, getListingById } from "@/lib/villas/server";

interface VillaPageProps {
  params: Promise<{ id: string }>;
}

async function getDetailAdvertisements(
  layout: AnyDetailLayoutConfig,
  villaZone: string,
): Promise<PublicAdvertisement[]> {
  if (!hasEnabledDetailLayoutBlock(layout, "advertisements")) {
    return [];
  }

  return getActiveAdvertisements(villaZone).catch((reason) => {
    console.error("Unable to load villa detail advertisements", reason);
    return [];
  });
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

  return buildVillaDetailMetadata({ settings, villa: listing });
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
  const advertisements = await getDetailAdvertisements(
    siteSettingsResult.settings.detailLayout,
    listing.zone,
  );
  const coverImageUrl = listing.coverImage
    ? buildMetadataImageUrl(listing.coverImage)
    : null;
  const jsonLd = [
    buildBreadcrumbJsonLd([
      { name: "หน้าแรก", path: "/" },
      { name: "ค้นหาบ้านพัก", path: "/search?guests=2&bedrooms=1&maxPrice=58900" },
      { name: getVillaTitle(listing), path: `/villas/${listing.id}` },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "VacationRental",
      name: getVillaTitle(listing),
      description: getVillaSearchIntentSummary(listing),
      image: coverImageUrl ? [coverImageUrl] : undefined,
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
      priceRange:
        listing.price === null
          ? undefined
          : `เริ่มต้น ${listing.price.toLocaleString("th-TH")} บาท/คืน`,
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <VillaDetailPage
        advertisements={advertisements}
        id={id}
        initialGalleryImages={data.initialGalleryImages}
        payload={data.payload}
        recommendedSection={data.recommendedSection}
        settings={siteSettingsResult.settings}
      />
    </>
  );
}
