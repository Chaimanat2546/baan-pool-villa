import { normalizePublicImageSourceUrl } from "@/lib/public-image-proxy";
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

export function normalizePublicVillaCoverImage(
  villa: Pick<VillaListing, "coverImage" | "id">,
): string | null {
  const coverImage = villa.coverImage?.trim();

  if (!coverImage) {
    return null;
  }

  try {
    const url = new URL(coverImage, "https://local.invalid");

    const isVillaImageRoute =
      url.origin === "https://local.invalid" &&
      url.pathname === `/api/villas/${encodeURIComponent(villa.id)}/images`;
    const imageId = url.searchParams.get("imageId");
    const sourceUrl = normalizePublicImageSourceUrl(url.searchParams.get("url"));

    if (isVillaImageRoute && /^[1-9]\d*$/.test(imageId ?? "")) {
      return `${url.pathname}?imageId=${imageId}`;
    }

    if (isVillaImageRoute && sourceUrl) {
      return `${url.pathname}?url=${encodeURIComponent(sourceUrl)}`;
    }
  } catch {
    return null;
  }

  return normalizePublicImageSourceUrl(coverImage);
}

export function toPublicVillaListing(villa: VillaListing): PublicVillaListing {
  return {
    ...villa,
    coverImage: normalizePublicVillaCoverImage(villa),
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
  void villaId;
  const imageUrl = normalizePublicImageSourceUrl(image.imageUrl);

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
