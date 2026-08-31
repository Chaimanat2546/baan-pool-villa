import {
  Bath,
  BedDouble,
  CircleDotDashed,
  Disc3,
  LifeBuoy,
  MicVocal,
  PawPrint,
  Star,
  Waves,
  WavesLadder,
  Wifi,
} from "lucide-react";
import { FaHotTubPerson, FaTableTennisPaddleBall } from "react-icons/fa6";
import { GiBarbecue, GiHockey, GiKidSlide, GiPoolTriangle } from "react-icons/gi";
import type { ElementType } from "react";
import type { Amenity, AmenityKey } from "@/lib/villas/types";

export const DEFAULT_AMENITY_PREVIEW_COUNT = 12;

const AMENITY_ICONS: Record<AmenityKey, ElementType> = {
  airhockey: GiHockey,
  bath: Bath,
  billard: GiPoolTriangle,
  discotech: Disc3,
  fancyring: LifeBuoy,
  extra_bed: BedDouble,
  grill: GiBarbecue,
  jacuzzi: FaHotTubPerson,
  karaoke: MicVocal,
  pet: PawPrint,
  private_pool: WavesLadder,
  slider: GiKidSlide,
  snooker: CircleDotDashed,
  swimming_kid: Waves,
  tabletennis: FaTableTennisPaddleBall,
  wifi: Wifi,
};

export function getAmenityIcon(amenityKey: Amenity["key"] | string) {
  if (!Object.prototype.hasOwnProperty.call(AMENITY_ICONS, amenityKey)) {
    return Star;
  }

  return AMENITY_ICONS[amenityKey as AmenityKey];
}
