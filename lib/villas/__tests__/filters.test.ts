import { describe, expect, it } from "vitest";

import {
  filterVillasById,
  filtersFromSearchParams,
  getDefaultFilters,
  normalizeFiltersForSearch,
  sortVillas,
} from "../filters";
import type { VillaListing } from "../types";

const villas: VillaListing[] = [
  {
    id: "9",
    zone: "pattaya",
    zoneLabel: "พัทยา",
    bedrooms: 3,
    bathrooms: 3,
    distanceToSea: "5 กม.",
    price: 12000,
    people: 8,
    coverImage: null,
    amenities: [],
    poolType: "salt",
  },
  {
    id: "25",
    zone: "jomtien",
    zoneLabel: "จอมเทียน",
    bedrooms: 5,
    bathrooms: 5,
    distanceToSea: "2 กม.",
    price: 9000,
    people: 15,
    coverImage: null,
    amenities: [],
    poolType: "chlorine",
  },
];

describe("normalizeFiltersForSearch", () => {
  it("keeps an explicit minimum price selection", () => {
    expect(normalizeFiltersForSearch(getDefaultFilters(1000), 61900).maxPrice).toBe(1000);
  });

  it("keeps a user-selected price under the available maximum", () => {
    expect(normalizeFiltersForSearch(getDefaultFilters(25000), 61900).maxPrice).toBe(25000);
  });

  it("clamps a user-selected price above the available maximum", () => {
    expect(normalizeFiltersForSearch(getDefaultFilters(90000), 61900).maxPrice).toBe(61900);
  });
});

describe("filtersFromSearchParams", () => {
  it("uses the available maximum when maxPrice is missing", () => {
    expect(filtersFromSearchParams(new URLSearchParams(), 61900).maxPrice).toBe(61900);
  });

  it("keeps an explicit maxPrice=1000 selection", () => {
    expect(
      filtersFromSearchParams(new URLSearchParams("maxPrice=1000"), 61900).maxPrice,
    ).toBe(1000);
  });

  it("keeps an explicit price above the low placeholder", () => {
    expect(
      filtersFromSearchParams(new URLSearchParams("maxPrice=25000"), 61900).maxPrice,
    ).toBe(25000);
  });
});

describe("filterVillasById", () => {
  it("matches plain numeric ids", () => {
    expect(filterVillasById(villas, "9").map((villa) => villa.id)).toEqual(["9"]);
  });

  it("matches display ids with DV prefix", () => {
    expect(filterVillasById(villas, "DV-25").map((villa) => villa.id)).toEqual(["25"]);
  });
});

describe("sortVillas", () => {
  it("sorts by price from low to high", () => {
    expect(sortVillas(villas, "price_asc").map((villa) => villa.id)).toEqual(["25", "9"]);
  });

  it("sorts by guest capacity from high to low", () => {
    expect(sortVillas(villas, "people_desc").map((villa) => villa.id)).toEqual(["25", "9"]);
  });

  it("does not mutate the original list", () => {
    sortVillas(villas, "price_asc");

    expect(villas.map((villa) => villa.id)).toEqual(["9", "25"]);
  });
});
