import { describe, expect, it } from "vitest";
import {
  filterVillas,
  getDefaultFilters,
  getMaxVillaPrice,
  getUniqueZones,
} from "../filters";
import type { VillaListing } from "../types";

const villas: VillaListing[] = [
  {
    id: "1",
    zone: "pattaya",
    zoneLabel: "พัทยา",
    bedrooms: 4,
    bathrooms: 4,
    distanceToSea: "1 กม.",
    price: 5000,
    people: 12,
    coverImage: null,
    poolType: "salt",
    amenities: [{ key: "karaoke", label: "คาราโอเกะ" }],
  },
  {
    id: "2",
    zone: "bangsaen",
    zoneLabel: "บางแสน",
    bedrooms: 2,
    bathrooms: 2,
    distanceToSea: "500 ม.",
    price: 2500,
    people: 4,
    coverImage: null,
    poolType: "chlorine",
    amenities: [{ key: "pet", label: "นำสัตว์เลี้ยงได้" }],
  },
];

describe("filterVillas", () => {
  it("keeps villas matching guests, bedrooms, max price, and selected amenities", () => {
    expect(
      filterVillas(villas, {
        zone: "all",
        guests: 10,
        bedrooms: 3,
        maxPrice: 6000,
        amenities: ["karaoke"],
      }).map((villa) => villa.id),
    ).toEqual(["1"]);
  });

  it("filters by exact zone unless zone is all", () => {
    expect(
      filterVillas(villas, {
        ...getDefaultFilters(6000),
        zone: "bangsaen",
      }).map((villa) => villa.id),
    ).toEqual(["2"]);
  });
});

describe("getDefaultFilters", () => {
  it("returns the default filter state for a max price", () => {
    expect(getDefaultFilters(6000)).toEqual({
      zone: "all",
      guests: 2,
      bedrooms: 1,
      amenities: [],
      maxPrice: 6000,
    });
  });
});

describe("getMaxVillaPrice", () => {
  it("returns zero for an empty villa list", () => {
    expect(getMaxVillaPrice([])).toBe(0);
  });

  it("returns the highest villa price", () => {
    expect(getMaxVillaPrice(villas)).toBe(5000);
  });
});

describe("getUniqueZones", () => {
  it("de-duplicates zones and sorts them by Thai label", () => {
    const zones = getUniqueZones([
      villas[0],
      { ...villas[0], id: "3" },
      {
        ...villas[1],
        id: "4",
        zone: "chaam",
        zoneLabel: "ชะอำ",
      },
    ]);

    expect(zones).toEqual([
      { value: "chaam", label: "ชะอำ" },
      { value: "pattaya", label: "พัทยา" },
    ]);
  });
});
