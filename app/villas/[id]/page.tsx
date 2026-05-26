import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VillaDetailPage } from "@/components/villas/detail/page";
import {
  absoluteUrl,
  buildPageMetadata,
  getVillaDescription,
  getVillaTitle,
} from "@/lib/seo";
import {
  fetchHouseListings,
  fetchVillaPageData,
  getListingById,
} from "@/lib/villas/server";

type VillaPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: VillaPageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListingById(id);

  if (!listing) {
    return buildPageMetadata({
      canonicalPath: `/villas/${id}`,
      description: "ไม่พบข้อมูลบ้านพักพูลวิลล่าที่คุณกำลังค้นหา",
      title: "ไม่พบข้อมูลบ้านพัก",
    });
  }

  return buildPageMetadata({
    canonicalPath: `/villas/${listing.id}`,
    description: getVillaDescription(listing),
    image: listing.coverImage,
    title: getVillaTitle(listing),
  });
}

export default async function Page({ params }: VillaPageProps) {
  const { id } = await params;
  const data = await fetchVillaPageData(id);

  if (!data) {
    notFound();
  }

  const listing = data.payload.listing;
  const allListings = await fetchHouseListings();
  const recommendedVillas = allListings
    .filter((villa) => villa.id !== listing.id)
    .slice(0, 12);
  const jsonLd = {
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
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <VillaDetailPage
        id={id}
        images={data.images}
        payload={data.payload}
        recommendedVillas={recommendedVillas}
      />
    </>
  );
}
