import type { VillaFilters, VillaListing } from "./types";

export type VillaSortKey =
  | "recommended"
  | "price_asc"
  | "price_desc"
  | "people_desc"
  | "bedrooms_desc";

export function getDefaultFilters(maxPrice: number): VillaFilters {
  return {
    zone: "all",
    guests: 2,
    bedrooms: 1,
    amenities: [],
    maxPrice,
  };
}

type FiltersToSearchParamsOptions = {
  omitMaxPrice?: boolean;
};

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

  return params;
}

export function normalizeFiltersForSearch(
  filters: VillaFilters,
  maxPrice: number,
): VillaFilters {
  const normalizedMaxPrice = Math.max(maxPrice, 1000);

  return {
    ...filters,
    maxPrice: Math.min(Math.max(1000, filters.maxPrice), normalizedMaxPrice),
  };
}

export function filtersFromSearchParams(
  searchParams: URLSearchParams,
  maxPrice: number,
): VillaFilters {
  const defaults = getDefaultFilters(maxPrice);
  const guests = Number(searchParams.get("guests"));
  const bedrooms = Number(searchParams.get("bedrooms"));
  const requestedMaxPriceParam = searchParams.get("maxPrice");
  const requestedMaxPrice =
    requestedMaxPriceParam === null ? NaN : Number(requestedMaxPriceParam);
  const amenities = searchParams
    .get("amenities")
    ?.split(",")
    .map((amenity) => amenity.trim())
    .filter(Boolean) ?? [];

  return {
    zone: searchParams.get("zone") || defaults.zone,
    guests: Number.isFinite(guests) ? Math.max(1, guests) : defaults.guests,
    bedrooms: Number.isFinite(bedrooms) ? Math.max(1, bedrooms) : defaults.bedrooms,
    amenities: amenities as VillaFilters["amenities"],
    maxPrice: Number.isFinite(requestedMaxPrice)
      ? Math.min(Math.max(1000, requestedMaxPrice), maxPrice)
      : defaults.maxPrice,
  };
}

export function filterVillas(
  villas: VillaListing[],
  filters: VillaFilters,
): VillaListing[] {
  return villas.filter((villa) => {
    const zoneMatches = filters.zone === "all" || villa.zone === filters.zone;
    const guestMatches = villa.people >= filters.guests;
    const bedroomMatches = villa.bedrooms >= filters.bedrooms;
    const priceMatches = villa.price <= filters.maxPrice;
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
      amenityMatches
    );
  });
}

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

export function getMaxVillaPrice(villas: VillaListing[]): number {
  return villas.reduce((max, villa) => Math.max(max, villa.price), 0);
}

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
