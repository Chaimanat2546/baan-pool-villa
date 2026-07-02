import { notFound, permanentRedirect } from "next/navigation";

import { getListingById } from "@/lib/villas/server";

interface LegacyVillaRedirectPageProps {
  params: Promise<{ legacy: string[] }>;
}

function isPositiveIntegerSegment(segment: string): boolean {
  if (segment.length === 0) {
    return false;
  }

  for (const character of segment) {
    if (character < "0" || character > "9") {
      return false;
    }
  }

  const numericValue = Number(segment);

  return Number.isSafeInteger(numericValue) && numericValue > 0;
}

export default async function Page({ params }: LegacyVillaRedirectPageProps) {
  const { legacy } = await params;
  const villaIdSegment = legacy.at(-1);

  if (!villaIdSegment || !isPositiveIntegerSegment(villaIdSegment)) {
    notFound();
  }

  const listing = await getListingById(villaIdSegment);

  if (!listing) {
    notFound();
  }

  permanentRedirect(`/villas/${listing.id}`);
}
