export interface PublicAdvertisement {
  id: string;
  imageUrl: string;
  imageUrls?: string[];
  title: string;
}

export interface PublicAdvertisementPage {
  advertisements: PublicAdvertisement[];
  nextCursor: string | null;
}

export const ADVERTISEMENT_PAGE_SIZE = 8;
export interface AdvertisementListFilters {
  search: string;
  zone: string;
  status: "all" | "active" | "inactive";
}

export const ADVERTISEMENT_BUCKET = "advertisement-assets";
export const ADVERTISEMENT_IMAGE_LIMIT = 2;
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
