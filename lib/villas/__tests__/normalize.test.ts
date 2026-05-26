import { describe, expect, it } from "vitest";
import { calculateCommission, normalizeHouse } from "../normalize";
import type { RawHouse } from "../types";

const rawHouse: RawHouse = {
  h_id: "9",
  h_zone: "pattaya",
  h_bedroom: "6",
  h_toilet: "6",
  h_farsea: "5.6 กม",
  wifi: "y",
  grill: "y",
  pet: "n",
  snooker: "y",
  discotech: "n",
  fancyring: "y",
  tabletennis: "n",
  slider: "y",
  billard: "n",
  swimming_kid: "y",
  swim: "chlorine",
  karaoke: "y",
  airhockey: "n",
  jacuzzi: "n",
  bath: "n",
  img_name: "cover.jpg",
  price: "8000",
  people: "9",
};

describe("normalizeHouse", () => {
  it("maps Deville list fields into a safe listing DTO", () => {
    expect(normalizeHouse(rawHouse)).toEqual({
      id: "9",
      zone: "pattaya",
      zoneLabel: "พัทยา",
      bedrooms: 6,
      bathrooms: 6,
      distanceToSea: "5.6 กม",
      price: 9900,
      people: 9,
      coverImage: "https://devillegroups.com/imgs/profile_imgs_large/cover.jpg",
      poolType: "chlorine",
      amenities: [
        { key: "wifi", label: "Wi-Fi" },
        { key: "grill", label: "เตาปิ้งย่าง" },
        { key: "snooker", label: "สนุกเกอร์" },
        { key: "fancyring", label: "ห่วงยางแฟนซี" },
        { key: "slider", label: "สไลเดอร์" },
        { key: "swimming_kid", label: "สระเด็ก" },
        { key: "karaoke", label: "คาราโอเกะ" },
      ],
    });
  });

  it("returns null cover image when img_name is missing", () => {
    expect(normalizeHouse({ ...rawHouse, img_name: null }).coverImage).toBeNull();
  });
});

describe("calculateCommission", () => {
  it.each([
    [8000, 9900],
    [8500, 9900],
    [28000, 29900],
    [28500, 30900],
    [47000, 49900],
    [47500, 50900],
    [48000, 51900],
  ])("returns %i as %i after applying commission", (price, expected) => {
    expect(calculateCommission(price)).toBe(expected);
  });
});
