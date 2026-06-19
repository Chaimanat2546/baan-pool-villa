import { buildVillaGalleryImageProxyUrl } from "@/lib/public-image-proxy";
import type { GalleryItem } from "./types";

export function buildGalleryDownloadHref(
  listingId: string,
  item: GalleryItem,
): string | null {
  const trimmedListingId = listingId.trim();
  const proxyUrl = normalizeGalleryProxyPath(item.url);

  if (trimmedListingId && proxyUrl) {
    proxyUrl.searchParams.set("download", "1");

    if (item.imageName) {
      proxyUrl.searchParams.set("name", item.imageName);
    }

    if (item.zoneKey) {
      proxyUrl.searchParams.set("zone", item.zoneKey);
    }

    return `${proxyUrl.pathname}?${proxyUrl.searchParams.toString()}`;
  }

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

function normalizeGalleryProxyPath(value: string): URL | null {
  const trimmedValue = value.trim();

  if (!trimmedValue.startsWith("/")) {
    return null;
  }

  try {
    const url = new URL(trimmedValue, "https://local.invalid");

    if (
      url.origin !== "https://local.invalid" ||
      !/^\/api\/villas\/[^/]+\/images$/.test(url.pathname) ||
      !/^[1-9]\d*$/.test(url.searchParams.get("imageId") ?? "")
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
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
  const proxyUrl = normalizeGalleryProxyPath(item.url);

  if (proxyUrl) {
    proxyUrl.searchParams.set("w", width.toString());
    proxyUrl.searchParams.set("q", quality.toString());
    return `${proxyUrl.pathname}?${proxyUrl.searchParams.toString()}`;
  }

  const targetUrl = normalizeGalleryDisplayImageUrl(item.url);

  return buildVillaGalleryImageProxyUrl(listingId, targetUrl, {
    quality,
    width,
  });
}
