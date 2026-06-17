import { AMENITY_OPTIONS } from "./amenities";
import type { AmenityKey, VillaFilters, VillaListing } from "./types";

export type VillaSortKey =
  | "recommended"
  | "price_asc"
  | "price_desc"
  | "people_desc"
  | "bedrooms_desc";

const MIN_SEARCH_PRICE = 1000;
const MIN_GUESTS = 1;
const MAX_GUESTS = 100;
const MIN_BEDROOMS = 1;
const MAX_BEDROOMS = 50;

export function getDefaultFilters(maxPrice: number): VillaFilters {
  return {
    zone: "all",
    guests: 2,
    bedrooms: 1,
    amenities: [],
    maxPrice: Math.max(maxPrice, MIN_SEARCH_PRICE),
    nearSeaOnly: false,
  };
}

const AMENITY_KEYS = new Set<AmenityKey>(
  AMENITY_OPTIONS.map((amenity) => amenity.key),
);

function normalizeBoundedCount(
  value: number,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.ceil(value)));
}

type FiltersToSearchParamsOptions = {
  omitMaxPrice?: boolean;
};

/**
 * Serializes normalized filter state back into the public search URL format.
 */
export function filtersToSearchParams(
  filters: VillaFilters,
  options: FiltersToSearchParamsOptions = {},
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.zone !== "all") {
    params.set("zone", filters.zone);
  }

  params.set("guests", String(filters.guests));
  params.set("bedrooms", String(filters.bedrooms));

  if (!options.omitMaxPrice) {
    params.set("maxPrice", String(filters.maxPrice));
  }

  if (filters.amenities.length > 0) {
    params.set("amenities", filters.amenities.join(","));
  }

  if (filters.nearSeaOnly) {
    params.set("nearSea", "1");
  }

  return params;
}

/**
 * Clamps UI filter values to the supported search bounds before they are used
 * in requests or persisted back to the URL.
 */
export function normalizeFiltersForSearch(
  filters: VillaFilters,
  maxPrice: number,
): VillaFilters {
  const normalizedMaxPrice = Math.max(maxPrice, MIN_SEARCH_PRICE);

  return {
    ...filters,
    guests: normalizeBoundedCount(filters.guests, 1, MIN_GUESTS, MAX_GUESTS),
    bedrooms: normalizeBoundedCount(
      filters.bedrooms,
      1,
      MIN_BEDROOMS,
      MAX_BEDROOMS,
    ),
    maxPrice: Math.min(
      Math.max(MIN_SEARCH_PRICE, filters.maxPrice),
      normalizedMaxPrice,
    ),
  };
}

/**
 * Reads public search params defensively so deep links with missing or invalid
 * values still resolve to a safe filter state.
 */
export function filtersFromSearchParams(
  searchParams: URLSearchParams,
  maxPrice: number,
): VillaFilters {
  const normalizedMaxPrice = Math.max(maxPrice, MIN_SEARCH_PRICE);
  const defaults = getDefaultFilters(normalizedMaxPrice);
  const guests = Number(searchParams.get("guests"));
  const bedrooms = Number(searchParams.get("bedrooms"));
  const requestedMaxPriceParam = searchParams.get("maxPrice");
  const requestedMaxPrice =
    requestedMaxPriceParam === null ? NaN : Number(requestedMaxPriceParam);
  const amenities: AmenityKey[] = [];

  searchParams
    .get("amenities")
    ?.split(",")
    .map((amenity) => amenity.trim())
    .forEach((amenity) => {
      const amenityKey = amenity as AmenityKey;

      if (AMENITY_KEYS.has(amenityKey) && !amenities.includes(amenityKey)) {
        amenities.push(amenityKey);
      }
    });

  return {
    zone: searchParams.get("zone") || defaults.zone,
    guests: normalizeBoundedCount(
      guests,
      defaults.guests,
      MIN_GUESTS,
      MAX_GUESTS,
    ),
    bedrooms: normalizeBoundedCount(
      bedrooms,
      defaults.bedrooms,
      MIN_BEDROOMS,
      MAX_BEDROOMS,
    ),
    amenities,
    maxPrice: Number.isFinite(requestedMaxPrice)
      ? Math.min(Math.max(MIN_SEARCH_PRICE, requestedMaxPrice), normalizedMaxPrice)
      : defaults.maxPrice,
    nearSeaOnly: searchParams.get("nearSea") === "1",
  };
}

/**
 * Parses mixed kilometer/meter distance strings from the upstream catalog into
 * a comparable kilometer value for near-sea filtering.
 */
export function getDistanceToSeaInKm(distanceToSea: string): number | null {
  const normalizedDistance = distanceToSea.trim().toLowerCase();

  if (!normalizedDistance || normalizedDistance === "-") {
    return null;
  }

  const matchedDistance = normalizedDistance.match(/(\d+(?:[.,]\d+)?)/);

  if (!matchedDistance) {
    return null;
  }

  const distance = Number(matchedDistance[1].replace(",", "."));

  if (!Number.isFinite(distance)) {
    return null;
  }

  if (
    normalizedDistance.includes("เมตร") ||
    normalizedDistance.includes("meter") ||
    normalizedDistance.includes(" m")
  ) {
    return distance / 1000;
  }

  return distance;
}

/**
 * Near-sea links use a fixed 2 km threshold so homepage deep links and search
 * filtering share the same interpretation.
 */
export function isNearSeaVilla(villa: VillaListing): boolean {
  const distanceInKm = getDistanceToSeaInKm(villa.distanceToSea);

  return distanceInKm !== null && distanceInKm <= 2;
}

/**
 * Applies the public search filter rules without mutating the source catalog.
 */
export function filterVillas(
  villas: VillaListing[],
  filters: VillaFilters,
): VillaListing[] {
  return villas.filter((villa) => {
    const zoneMatches = filters.zone === "all" || villa.zone === filters.zone;
    const guestMatches = villa.people >= filters.guests;
    const bedroomMatches = villa.bedrooms >= filters.bedrooms;
    const priceMatches = villa.price <= filters.maxPrice;
    const nearSeaMatches = !filters.nearSeaOnly || isNearSeaVilla(villa);
    const villaAmenityKeys = new Set(
      villa.amenities.map((amenity) => amenity.key),
    );
    const amenityMatches = filters.amenities.every((key) =>
      villaAmenityKeys.has(key),
    );

    return (
      zoneMatches &&
      guestMatches &&
      bedroomMatches &&
      priceMatches &&
      nearSeaMatches &&
      amenityMatches
    );
  });
}

/**
 * Supports forgiving villa-id matching so search can find houses from plain
 * numeric ids or prefixed forms like `dv123`.
 */
export function filterVillasById(
  villas: VillaListing[],
  villaIdQuery: string,
): VillaListing[] {
  const normalizedQuery = villaIdQuery.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  if (!normalizedQuery) {
    return villas;
  }

  return villas.filter((villa) => {
    const normalizedId = villa.id.toLowerCase().replace(/[^a-z0-9]/g, "");

    return (
      normalizedQuery === normalizedId ||
      normalizedQuery === `dv${normalizedId}`
    );
  });
}

/**
 * Returns a sorted copy so callers can reuse the original listing order for
 * the default recommended view.
 */
export function sortVillas(
  villas: VillaListing[],
  sortKey: VillaSortKey,
): VillaListing[] {
  const sortedVillas = [...villas];

  switch (sortKey) {
    case "price_asc":
      return sortedVillas.sort((a, b) => a.price - b.price);
    case "price_desc":
      return sortedVillas.sort((a, b) => b.price - a.price);
    case "people_desc":
      return sortedVillas.sort((a, b) => b.people - a.people);
    case "bedrooms_desc":
      return sortedVillas.sort((a, b) => b.bedrooms - a.bedrooms);
    case "recommended":
    default:
      return sortedVillas;
  }
}

/**
 * Derives the highest listing price for slider bounds and other price-based UI
 * defaults.
 */
export function getMaxVillaPrice(villas: VillaListing[]): number {
  return villas.reduce((max, villa) => Math.max(max, villa.price), 0);
}

/**
 * Preserves one label per zone value so filter controls stay stable even when
 * many villas belong to the same zone.
 */
export function getUniqueZones(
  villas: VillaListing[],
): Array<{ value: string; label: string }> {
  const zones = new Map<string, string>();

  villas.forEach((villa) => {
    zones.set(villa.zone, villa.zoneLabel);
  });

  return Array.from(zones, ([value, label]) => ({ value, label })).sort(
    (a, b) => a.label.localeCompare(b.label, "th"),
  );
}
