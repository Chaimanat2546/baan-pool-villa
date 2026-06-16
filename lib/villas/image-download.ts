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
 * Normalize and validate an image URL string for download.
 *
 * Trims the input and, if non-empty, parses it as a URL; only accepts `https:` URLs with no username or password and returns the URL's canonical string form. Returns `null` when the input is empty, cannot be parsed as a URL, or fails validation.
 *
 * @param value - The raw URL string to normalize (may be `null`)
 * @returns The normalized URL string if `value` is a valid `https` URL without credentials, `null` otherwise
 */
export function normalizeDownloadImageUrl(value: string | null): string | null {
  return normalizePublicImageSourceUrl(value);
}

/**
 * Checks whether an image URL belongs to the villa's known Supabase image rows.
 *
 * @param imageUrl - The image URL to verify
 * @param images - Array of villa images to check against (`image.imageUrl` is compared)
 * @returns `true` if `imageUrl` equals any `image.imageUrl` in `images`, `false` otherwise.
 */
export function isAllowedVillaImageUrl(
  imageUrl: string,
  images: VillaImage[],
): boolean {
  return images.some((image) => normalizeDownloadImageUrl(image.imageUrl) === imageUrl);
}

/**
 * Produces a lowercase slug fragment suitable for filenames or identifiers.
 *
 * @param value - Input string to normalize; may be null or undefined
 * @returns The normalized slug with runs of non-alphanumeric characters replaced by `-` and a trailing dot-extension removed; `null` if the input is falsy or the result is empty
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
 * Determine the file extension for an image based on its MIME type or, if necessary, the source URL.
 *
 * @param contentType - The image MIME type (may include `;` parameters)
 * @param sourceUrl - Optional source URL used as a fallback to extract an extension from the pathname
 * @returns The file extension (without a leading dot), normalized to lowercase; returns `"jpg"` when the extension cannot be determined
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
 * Builds a sanitized download filename for a villa image.
 *
 * The filename is constructed from these parts (in order): the literal `"villa"`, a slugified
 * `villaId`, an optional slugified `zoneKey`, and either a slugified `imageName` or a slugified
 * fallback from `sourceUrl`. Parts that are missing are omitted and remaining parts are joined by
 * hyphens. The file extension is chosen from `contentType` or inferred from `sourceUrl`, with a
 * `"jpg"` fallback.
 *
 * @param contentType - MIME type used to determine the file extension
 * @param imageName - Optional human-readable image name to include in the filename
 * @param sourceUrl - Optional source URL used as a fallback for the name and extension
 * @param villaId - Villa identifier included and slugified in the filename
 * @param zoneKey - Optional zone identifier included and slugified in the filename
 * @returns The resulting filename including its extension (e.g., `villa-my-villa-beach.jpg`)
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
 * Produce a safe `Content-Disposition` header value for downloading a file.
 *
 * @param filename - The original filename to sanitize; may contain unsafe characters and whitespace
 * @returns The `Content-Disposition` header string `attachment; filename="..."` using a sanitized filename where runs of disallowed characters are replaced with `-`, leading/trailing `-` are removed, and `"villa-image.jpg"` is used when the sanitized name is empty
 */
export function createAttachmentDisposition(filename: string): string {
  const safeFilename = filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `attachment; filename="${safeFilename || "villa-image.jpg"}"`;
}
