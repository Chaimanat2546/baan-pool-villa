import { AnalyticsPageReady } from "@/components/layout/analytics-page-ready";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { VillaDetailPage } from "@/components/villas/detail/page";
import { hasEnabledDetailLayoutBlock } from "@/components/villas/detail/detail-page-helpers";
import { getActiveAdvertisements } from "@/lib/advertisements/server";
import type { PublicAdvertisementPage } from "@/lib/advertisements/types";
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
import { getSiteContactSettings } from "@/lib/site-contact-settings/server";
import { getSiteWebStyles } from "@/lib/site-web-styles/server";
import { preloadVillaBookingCalendar } from "@/lib/villas/booking-calendar-preload";
import { getMinimumGuestCapacity } from "@/lib/villas/booking-calendar";
import { fetchVillaPageData, getListingById } from "@/lib/villas/server";

interface VillaPageProps {
  params: Promise<{ id: string }>;
}

async function getDetailAdvertisements(
  layout: AnyDetailLayoutConfig,
  villaZone: string,
): Promise<PublicAdvertisementPage> {
  if (!hasEnabledDetailLayoutBlock(layout, "advertisements")) {
    return { advertisements: [], nextCursor: null };
  }

  return getActiveAdvertisements(villaZone).catch((reason) => {
    console.error("Unable to load villa detail advertisements", reason);
    return { advertisements: [], nextCursor: null };
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
  await connection();
  const { id } = await params;
  const [resolvedListing, siteWebStylesResult] = await Promise.all([
    getListingById(id),
    getSiteWebStyles(),
  ]);
  if (!resolvedListing) {
    notFound();
  }

  const [
    data,
    siteSettingsResult,
    contactSettingsResult,
    { calendar, monthKey },
  ] = await Promise.all([
    fetchVillaPageData(
      resolvedListing.id,
      siteWebStylesResult.gallery.imageSource,
      resolvedListing,
    ),
    getSiteSettings(),
    getSiteContactSettings(),
    preloadVillaBookingCalendar(resolvedListing.id),
  ]);

  if (!data) {
    notFound();
  }

  const listing = data.payload.listing;
  const startingGuestCapacity = getMinimumGuestCapacity(calendar ? { [monthKey]: calendar } : {});
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
      description: getVillaSearchIntentSummary(listing, startingGuestCapacity),
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
      <AnalyticsPageReady pagePath={`/villas/${listing.id}`} villaId={listing.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <VillaDetailPage
        advertisements={advertisements.advertisements}
        advertisementCursor={advertisements.nextCursor}
        currentBookingMonthKey={monthKey}
        galleryStyle={siteWebStylesResult.gallery}
        id={listing.id}
        initialBookingCalendar={calendar}
        initialGalleryImages={data.initialGalleryImages}
        initialGalleryLoadFailed={data.initialGalleryLoadFailed}
        initialGalleryPreviewImages={data.initialGalleryPreviewImages}
        payload={data.payload}
        recommendedSection={data.recommendedSection}
        contactSettings={contactSettingsResult.settings}
        settings={siteSettingsResult.settings}
        startingGuestCapacity={startingGuestCapacity}
        villaCardStyle={siteWebStylesResult.houseCard.variant}
      />
    </>
  );
}
