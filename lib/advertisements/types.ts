export interface PublicAdvertisement {
  id: string;
  imageUrl: string;
  imageUrls?: string[];
  title: string;
}

export const ADVERTISEMENT_BUCKET = "advertisement-assets";
export const ADVERTISEMENT_IMAGE_LIMIT = 12;
export interface AdvertisementImage {
  id: string;
  storagePath: string;
  url: string;
}
export interface AdminAdvertisement {
  id: string;
  title: string;
  zone: string;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
  images: AdvertisementImage[];
}
export interface AdvertisementDraft {
  id: string;
  title: string;
  zone: string;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string | null;
  images: ({ id: string } | { uploadIndex: number })[];
}
