import {
  Bath,
  BedDouble,
  Bubbles,
  CircleDot,
  CircleDotDashed,
  Disc3,
  Flame,
  Goal,
  LifeBuoy,
  MicVocal,
  PawPrint,
  Table2,
  Star,
  Waves,
  WavesArrowDown,
  WavesLadder,
  Wifi,
} from "lucide-react";
import type { Amenity, AmenityKey } from "@/lib/villas/types";

export const DEFAULT_AMENITY_PREVIEW_COUNT = 12;

const AMENITY_ICONS: Record<AmenityKey, typeof Wifi> = {
  airhockey: Goal,
  bath: Bath,
  billard: CircleDot,
  discotech: Disc3,
  fancyring: LifeBuoy,
  extra_bed: BedDouble,
  grill: Flame,
  jacuzzi: Bubbles,
  karaoke: MicVocal,
  pet: PawPrint,
  private_pool: WavesLadder,
  slider: WavesArrowDown,
  snooker: CircleDotDashed,
  swimming_kid: Waves,
  tabletennis: Table2,
  wifi: Wifi,
};

export function getAmenityIcon(amenityKey: Amenity["key"] | string) {
  if (!Object.prototype.hasOwnProperty.call(AMENITY_ICONS, amenityKey)) {
    return Star;
  }

  return AMENITY_ICONS[amenityKey as AmenityKey];
}
