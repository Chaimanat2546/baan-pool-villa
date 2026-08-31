import type { Amenity, AmenityKey, RawHouse } from "./types";

export const AMENITY_OPTIONS: Amenity[] = [
  { key: "wifi", label: "Wi-Fi" },
  { key: "grill", label: "เตาปิ้งย่าง" },
  { key: "pet", label: "สัตว์เลี้ยง" },
  { key: "snooker", label: "สนุกเกอร์" },
  { key: "discotech", label: "ไฟเธค" },
  { key: "fancyring", label: "ห่วงยางแฟนซี" },
  { key: "tabletennis", label: "โต๊ะปิงปอง" },
  { key: "slider", label: "สไลเดอร์" },
  { key: "billard", label: "โต๊ะพูล" },
  { key: "swimming_kid", label: "สระเด็ก" },
  { key: "karaoke", label: "คาราโอเกะ" },
  { key: "airhockey", label: "แอร์ฮอกกี้" },
  { key: "jacuzzi", label: "จากุซซี่" },
  { key: "bath", label: "อ่างอาบน้ำ" },
  { key: "private_pool", label: "สระว่ายน้ำส่วนตัว" },
  { key: "extra_bed", label: "เตียงเสริม" },
];

const FACILITY_AMENITY_KEY_ALIASES: Partial<Record<string, AmenityKey>> = {
  air_hockey: "airhockey",
  bathtub: "bath",
  billiard: "billard",
  disco_tech: "discotech",
  kid_pool: "swimming_kid",
  pets: "pet",
  pool_float: "fancyring",
  table_tennis: "tabletennis",
};

export const AMENITY_LABELS = Object.fromEntries(
  AMENITY_OPTIONS.map((amenity) => [amenity.key, amenity.label]),
) as Record<AmenityKey, string>;

/**
 * Maps the listing feed's amenity flags into the shared amenity objects used by
 * search filters and villa cards.
 *
 * @param house - The raw villa listing record from the external house feed.
 * @returns The enabled amenity objects recognized by this repository.
 */
export function getHouseAmenities(house: RawHouse): Amenity[] {
  return AMENITY_OPTIONS.filter((amenity) => house[amenity.key] === "y");
}

export function normalizeAmenityKey(key: string): AmenityKey | null {
  const normalizedKey = key.trim().toLowerCase();

  if (!normalizedKey) {
    return null;
  }

  return (
    FACILITY_AMENITY_KEY_ALIASES[normalizedKey] ??
    (Object.prototype.hasOwnProperty.call(AMENITY_LABELS, normalizedKey)
      ? (normalizedKey as AmenityKey)
      : null)
  );
}
