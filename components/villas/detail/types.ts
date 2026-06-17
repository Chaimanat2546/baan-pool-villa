import type {
  RecommendedVillaSection,
  VillaImage,
  VillaDetailPayload,
} from "@/lib/villas/types";
import type { SiteSettings } from "@/lib/site-settings/types";

export interface VillaDetailPageProps {
  id: string;
  initialGalleryImages?: VillaImage[];
  payload: VillaDetailPayload;
  recommendedSection: RecommendedVillaSection | null;
  settings: SiteSettings;
}

export interface GalleryItem {
  key: string;
  url: string;
  caption: string | null;
  isCover: boolean;
  imageName: string | null;
  isMock: boolean;
  zone: string | null;
  zoneLabel: string;
  zoneKey: string;
}

export interface GalleryCategory {
  key: string;
  label: string;
  items: GalleryItem[];
}
