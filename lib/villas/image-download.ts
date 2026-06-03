import "server-only";

import type { VillaDetailPayload, VillaImage } from "./types";

const IMAGE_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function normalizeDownloadImageUrl(value: string | null): string | null {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    const url = new URL(trimmedValue);

    if (url.protocol !== "https:" || url.username || url.password) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function isAllowedVillaImageUrl(
  imageUrl: string,
  images: VillaImage[],
  detailPayload: VillaDetailPayload | null,
): boolean {
  if (images.some((image) => image.imageUrl === imageUrl)) {
    return true;
  }

  return detailPayload?.listing.coverImage === imageUrl;
}

function slugPart(value: string | null | undefined): string | null {
  const slug = value
    ?.trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || null;
}

function getImageExtension(contentType: string, sourceUrl?: string): string {
  const normalizedContentType = contentType.split(";")[0]?.trim().toLowerCase();
  const knownExtension = IMAGE_EXTENSION_BY_CONTENT_TYPE[normalizedContentType];

  if (knownExtension) {
    return knownExtension;
  }

  if (sourceUrl) {
    try {
      const extension = new URL(sourceUrl).pathname
        .split("/")
        .pop()
        ?.match(/\.([a-z0-9]{2,5})$/i)?.[1]
        ?.toLowerCase();

      if (extension) {
        return extension === "jpeg" ? "jpg" : extension;
      }
    } catch {
      return "jpg";
    }
  }

  return "jpg";
}

export function buildImageDownloadFilename({
  contentType,
  imageName,
  sourceUrl,
  villaId,
  zoneKey,
}: {
  contentType: string;
  imageName?: string | null;
  sourceUrl?: string;
  villaId: string;
  zoneKey?: string | null;
}): string {
  const parts = [
    "villa",
    slugPart(villaId),
    slugPart(zoneKey),
    slugPart(imageName) ?? slugPart(sourceUrl),
  ].filter((part): part is string => Boolean(part));
  const extension = getImageExtension(contentType, sourceUrl);

  return `${parts.join("-") || "villa-image"}.${extension}`;
}

export function createAttachmentDisposition(filename: string): string {
  const safeFilename = filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `attachment; filename="${safeFilename || "villa-image.jpg"}"`;
}
