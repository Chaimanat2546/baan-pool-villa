import { buildVillaGalleryImageProxyUrl } from "@/lib/public-image-proxy";
import type { GalleryItem } from "./types";

export function buildGalleryDownloadHref(
  listingId: string,
  item: GalleryItem,
): string | null {
  const trimmedListingId = listingId.trim();
  const targetUrl = normalizeGalleryDisplayImageUrl(item.url);

  if (!trimmedListingId || !targetUrl) {
    return null;
  }

  const params = new URLSearchParams({
    download: "1",
    url: targetUrl,
  });

  if (item.imageName) {
    params.set("name", item.imageName);
  }

  if (item.zoneKey) {
    params.set("zone", item.zoneKey);
  }

  return `/api/villas/${encodeURIComponent(trimmedListingId)}/images?${params.toString()}`;
}

export function normalizeGalleryDisplayImageUrl(value: string): string | null {
  const trimmedValue = value.trim();

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

export function buildGalleryDisplaySrc(
  listingId: string,
  item: GalleryItem,
  width = 828,
  quality = 60,
): string | null {
  const targetUrl = normalizeGalleryDisplayImageUrl(item.url);

  return buildVillaGalleryImageProxyUrl(listingId, targetUrl, {
    quality,
    width,
  });
}
