import { getHouseAmenities } from "./amenities";
import type { RawHouse, VillaListing } from "./types";

const PROFILE_IMAGE_BASE = "https://devillegroups.com/imgs/profile_imgs_large";

const ZONE_LABELS: Record<string, string> = {
  pattaya: "พัทยา",
};

function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Applies the shared listing commission rules so public villa prices stay
 * consistent across routes and components.
 */
export function calculateCommission(price: string | number | null | undefined): number {
  const numericPrice = toNumber(price);
  const last3 = numericPrice % 1000;

  if (numericPrice <= 28000) {
    return Math.trunc(numericPrice + (last3 === 500 ? 1400 : 1900));
  }

  if (numericPrice <= 47000) {
    return Math.trunc(numericPrice + (last3 === 500 ? 2400 : 2900));
  }

  return Math.trunc(numericPrice + (last3 === 500 ? 3400 : 3900));
}

export function getZoneLabel(zone: string): string {
  return ZONE_LABELS[zone] ?? zone;
}

/**
 * Normalizes the external listing payload into the stable card/list shape used
 * throughout the public UI.
 */
export function normalizeHouse(house: RawHouse): VillaListing {
  const zone = house.h_zone?.trim() || "unknown";
  const imageName = house.img_name?.trim();

  return {
    id: String(house.h_id),
    zone,
    zoneLabel: getZoneLabel(zone),
    bedrooms: toNumber(house.h_bedroom),
    bathrooms: toNumber(house.h_toilet),
    distanceToSea: house.h_farsea?.trim() || "-",
    price: calculateCommission(house.price),
    people: toNumber(house.people),
    coverImage: imageName ? `${PROFILE_IMAGE_BASE}/${imageName}` : null,
    amenities: getHouseAmenities(house),
    poolType: house.swim?.trim() || "-",
  };
}

/**
 * Keeps batch listing normalization in one shared path so callers do not
 * duplicate upstream cleanup rules.
 */
export function normalizeHouses(houses: RawHouse[]): VillaListing[] {
  return houses.map(normalizeHouse);
}
