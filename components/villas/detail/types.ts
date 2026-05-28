import type {
  VillaDetailPayload,
  VillaImage,
  VillaListing,
} from "@/lib/villas/types";

export interface VillaDetailPageProps {
  id: string;
  images: VillaImage[];
  payload: VillaDetailPayload;
  recommendedVillas: VillaListing[];
};

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
};

export interface GalleryCategory {
  key: string;
  label: string;
  items: GalleryItem[];
};
