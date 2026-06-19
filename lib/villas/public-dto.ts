import {
  buildVillaCoverImageProxyPath,
  buildVillaGalleryImageProxyPath,
} from "@/lib/public-image-proxy";
import type {
  RecommendedVillaSection,
  VillaDetailPayload,
  VillaImage,
  VillaListing,
} from "./types";

export type PublicVillaListing = VillaListing;
export type PublicVillaImage = VillaImage;
export type PublicVillaDetailPayload = Omit<VillaDetailPayload, "listing"> & {
  listing: PublicVillaListing;
};
export type PublicRecommendedVillaSection = Omit<
  RecommendedVillaSection,
  "villas"
> & {
  villas: PublicVillaListing[];
};

export function toPublicVillaListing(villa: VillaListing): PublicVillaListing {
  return {
    ...villa,
    coverImage: villa.coverImage ? buildVillaCoverImageProxyPath(villa.id) : null,
  };
}

export function toPublicVillaListings(
  villas: VillaListing[],
): PublicVillaListing[] {
  return villas.map(toPublicVillaListing);
}

export function toPublicVillaImage(
  villaId: string,
  image: VillaImage,
): PublicVillaImage | null {
  const imageUrl = buildVillaGalleryImageProxyPath(villaId, image.id);

  return imageUrl ? { ...image, imageUrl } : null;
}

export function toPublicVillaImages(
  villaId: string,
  images: VillaImage[],
): PublicVillaImage[] {
  return images
    .map((image) => toPublicVillaImage(villaId, image))
    .filter((image): image is PublicVillaImage => image !== null);
}

export function toPublicVillaDetailPayload(
  payload: VillaDetailPayload,
): PublicVillaDetailPayload {
  return {
    ...payload,
    listing: toPublicVillaListing(payload.listing),
  };
}

export function toPublicRecommendedVillaSection(
  section: RecommendedVillaSection | null,
): PublicRecommendedVillaSection | null {
  return section
    ? {
        ...section,
        villas: toPublicVillaListings(section.villas),
      }
    : null;
}
