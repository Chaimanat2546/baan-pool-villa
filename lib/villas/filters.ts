import { AMENITY_OPTIONS } from "./amenities";
import {
  SEARCH_DEFAULT_MAX_PRICE,
  SEARCH_MIN_PRICE,
} from "./search-options";
import type { AmenityKey, VillaFilters, VillaListing } from "./types";

export type VillaSortKey =
  | "recommended"
  | "price_asc"
  | "price_desc"
  | "people_desc"
  | "bedrooms_desc";

const MIN_SEARCH_PRICE = SEARCH_MIN_PRICE;
const MIN_GUESTS = 1;
const MAX_GUESTS = 100;
const MIN_BEDROOMS = 1;
const MAX_BEDROOMS = 50;

/**
 * Creates the default public search filters for the current listing price
 * range.
 *
 * @param maxPrice - The highest villa price currently available in the catalog.
 * @returns The default filter state used by the search UI.
 */
export function getDefaultFilters(maxPrice: number): VillaFilters {
  const normalizedMaxPrice = Math.max(maxPrice, MIN_SEARCH_PRICE);

  return {
    zone: "all",
    guests: 2,
    bedrooms: 1,
    amenities: [],
    maxPrice: Math.min(SEARCH_DEFAULT_MAX_PRICE, normalizedMaxPrice),
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
 *
 * @param filters - The normalized filter state to encode.
 * @param options - Optional serialization flags for URL generation.
 * @returns URL search params matching the public search-page contract.
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
 *
 * @param filters - The current filter state from UI or URL input.
 * @param maxPrice - The highest villa price currently available in the catalog.
 * @returns A safe filter object constrained to supported search bounds.
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
 *
 * @param searchParams - The current search params from the public URL.
 * @param maxPrice - The highest villa price currently available in the catalog.
 * @returns A normalized filter object ready for search UI and filtering.
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
 *
 * @param distanceToSea - The raw distance string from the villa listing feed.
 * @returns The distance in kilometers, or `null` when the value is unusable.
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
 *
 * @param villa - The normalized villa listing to evaluate.
 * @returns `true` when the villa is within the shared near-sea threshold.
 */
export function isNearSeaVilla(villa: VillaListing): boolean {
  const distanceInKm = getDistanceToSeaInKm(villa.distanceToSea);

  return distanceInKm !== null && distanceInKm <= 2;
}

/**
 * Applies the public search filter rules without mutating the source catalog.
 *
 * @param villas - The source villa listings to filter.
 * @param filters - The normalized filter rules to apply.
 * @returns A filtered array of villa listings that match the active filters.
 */
export function filterVillas(
  villas: VillaListing[],
  filters: VillaFilters,
): VillaListing[] {
  return villas.filter((villa) => {
    const zoneMatches = filters.zone === "all" || villa.zone === filters.zone;
    const guestMatches = villa.people >= filters.guests;
    const bedroomMatches = villa.bedrooms >= filters.bedrooms;
    const priceMatches = villa.price === null || villa.price <= filters.maxPrice;
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
 * Supports forgiving listing search by title, property id, or prefixed forms
 * like `dv123`.
 *
 * @param villas - The source villa listings to search.
 * @param villaIdQuery - The raw search query entered by the user.
 * @returns The matching villa listings after query normalization.
 */
export function filterVillasById(
  villas: VillaListing[],
  villaIdQuery: string,
): VillaListing[] {
  const normalizedQuery = villaIdQuery.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const titleQuery = villaIdQuery.trim().toLowerCase();

  if (!normalizedQuery && !titleQuery) {
    return villas;
  }

  return villas.filter((villa) => {
    const normalizedId = villa.id.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normalizedTitle = villa.title?.toLowerCase() ?? "";

    return (
      normalizedQuery === normalizedId ||
      normalizedQuery === `dv${normalizedId}` ||
      (titleQuery !== "" && normalizedTitle.includes(titleQuery))
    );
  });
}

/**
 * Returns a sorted copy so callers can reuse the original listing order for
 * the default recommended view.
 *
 * @param villas - The source villa listings to sort.
 * @param sortKey - The public sort mode to apply.
 * @returns A sorted copy of the source villa listings.
 */
export function sortVillas(
  villas: VillaListing[],
  sortKey: VillaSortKey,
): VillaListing[] {
  const sortedVillas = [...villas];
  const comparePrices = (
    left: VillaListing,
    right: VillaListing,
    direction: "asc" | "desc",
  ) => {
    if (left.price === null && right.price === null) {
      return 0;
    }

    if (left.price === null) {
      return 1;
    }

    if (right.price === null) {
      return -1;
    }

    return direction === "asc"
      ? left.price - right.price
      : right.price - left.price;
  };

  switch (sortKey) {
    case "price_asc":
      return sortedVillas.sort((a, b) => comparePrices(a, b, "asc"));
    case "price_desc":
      return sortedVillas.sort((a, b) => comparePrices(a, b, "desc"));
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
 *
 * @param villas - The source villa listings to inspect.
 * @returns The highest villa price in the provided list, or `0` when empty.
 */
export function getMaxVillaPrice(villas: VillaListing[]): number {
  return villas.reduce(
    (max, villa) => Math.max(max, villa.price ?? 0),
    0,
  );
}

/**
 * Preserves one label per zone value so filter controls stay stable even when
 * many villas belong to the same zone.
 *
 * @param villas - The source villa listings to inspect.
 * @returns Unique zone options sorted by their Thai labels.
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
