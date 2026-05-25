import type { VillaFilters, VillaListing } from "./types";

export function getDefaultFilters(maxPrice: number): VillaFilters {
  return {
    zone: "all",
    guests: 2,
    bedrooms: 1,
    amenities: [],
    maxPrice,
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
