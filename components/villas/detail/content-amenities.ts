import {
  Bath,
  CircleDot,
  Flame,
  Music,
  PawPrint,
  Star,
  Waves,
  Wifi,
} from "lucide-react";
import type { Amenity, AmenityKey } from "@/lib/villas/types";

export const DEFAULT_AMENITY_PREVIEW_COUNT = 12;

const AMENITY_ICONS: Record<AmenityKey, typeof Wifi> = {
  airhockey: CircleDot,
  bath: Bath,
  billard: CircleDot,
  discotech: Music,
  fancyring: Waves,
  grill: Flame,
  jacuzzi: Bath,
  karaoke: Music,
  pet: PawPrint,
  slider: Waves,
  snooker: CircleDot,
  swimming_kid: Waves,
  tabletennis: CircleDot,
  wifi: Wifi,
};

export function getAmenityIcon(amenityKey: Amenity["key"] | string) {
  if (!Object.prototype.hasOwnProperty.call(AMENITY_ICONS, amenityKey)) {
    return Star;
  }

  return AMENITY_ICONS[amenityKey as AmenityKey];
}
