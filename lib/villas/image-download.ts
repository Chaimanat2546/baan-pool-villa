import "server-only";

import { normalizePublicImageSourceUrl } from "@/lib/public-image-proxy";
import type { VillaImage } from "./types";

const IMAGE_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Normalizes and validates an image URL before it is used for downloads.
 *
 * Reuses the shared public-image validation rules so download handling stays
 * aligned with the same protocol and credential restrictions as other public
 * image flows.
 *
 * @param value - The raw image URL value to validate.
 * @returns The normalized URL when it is allowed, or `null` when invalid.
 */
export function normalizeDownloadImageUrl(value: string | null): string | null {
  return normalizePublicImageSourceUrl(value);
}

/**
 * Checks whether an image URL belongs to the villa's known image rows.
 *
 * This keeps the download route limited to images already resolved for the
 * requested villa instead of allowing arbitrary remote URLs.
 *
 * @param imageUrl - The normalized image URL to verify.
 * @param images - The resolved villa images allowed for this villa.
 * @returns `true` when the URL matches one of the villa's known images.
 */
export function isAllowedVillaImageUrl(
  imageUrl: string,
  images: VillaImage[],
): boolean {
  return images.some((image) => normalizeDownloadImageUrl(image.imageUrl) === imageUrl);
}

/**
 * Produces a lowercase slug fragment suitable for download filenames.
 */
function slugPart(value: string | null | undefined): string | null {
  const slug = value
    ?.trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || null;
}

/**
 * Prefers MIME-derived extensions, then falls back to the source URL, with
 * `jpg` as the final safe default.
 */
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

/**
 * Builds a stable download filename from villa metadata and the detected image
 * extension.
 *
 * The filename keeps a predictable `villa-...` shape so downloads remain
 * readable even when upstream image names are inconsistent or missing.
 *
 * @param contentType - The response MIME type used to derive the file extension.
 * @param imageName - An optional image name to include in the filename.
 * @param sourceUrl - An optional source URL used as a fallback for the name and extension.
 * @param villaId - The villa identifier to include in the filename.
 * @param zoneKey - An optional zone identifier to include in the filename.
 * @returns A sanitized filename with an extension, such as `villa-pattaya-12.jpg`.
 */
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

/**
 * Builds a safe attachment header value from a candidate filename.
 *
 * @param filename - The candidate filename to sanitize.
 * @returns A `Content-Disposition` value with a safe fallback filename.
 */
export function createAttachmentDisposition(filename: string): string {
  const safeFilename = filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `attachment; filename="${safeFilename || "villa-image.jpg"}"`;
}
