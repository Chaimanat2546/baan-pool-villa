import type { Amenity, AmenityKey, RawHouse } from "./types";

export const AMENITY_OPTIONS: Amenity[] = [
  { key: "wifi", label: "Wi-Fi" },
  { key: "grill", label: "เตาปิ้งย่าง" },
  { key: "pet", label: "นำสัตว์เลี้ยงได้" },
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
];

export const AMENITY_LABELS = Object.fromEntries(
  AMENITY_OPTIONS.map((amenity) => [amenity.key, amenity.label]),
) as Record<AmenityKey, string>;

export function getHouseAmenities(house: RawHouse): Amenity[] {
  return AMENITY_OPTIONS.filter((amenity) => house[amenity.key] === "y");
}
