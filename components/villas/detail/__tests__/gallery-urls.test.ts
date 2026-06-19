import { describe, expect, it } from "vitest";

import {
  buildGalleryDisplaySrc,
  buildGalleryDownloadHref,
  normalizeGalleryDisplayImageUrl,
} from "../gallery-urls";
import type { GalleryItem } from "../types";

function galleryItem(overrides: Partial<GalleryItem> = {}): GalleryItem {
  return {
    caption: null,
    imageName: "pool.jpg",
    isCover: false,
    isMock: false,
    key: "pool",
    url: "https://cdn.test/pool.jpg",
    zone: "pool",
    zoneKey: "pool-zone",
    zoneLabel: "Pool",
    ...overrides,
  };
}

describe("gallery URL helpers", () => {
  it("builds download and display proxy URLs for safe gallery images", () => {
    const item = galleryItem();
    const downloadUrl = new URL(
      buildGalleryDownloadHref("villa 88", item),
      "https://example.com",
    );
    const displayUrl = new URL(
      buildGalleryDisplaySrc("88", item) ?? "",
      "https://example.com",
    );

    expect(downloadUrl.pathname).toBe("/api/villas/villa%2088/images");
    expect(downloadUrl.searchParams.get("download")).toBe("1");
    expect(downloadUrl.searchParams.get("url")).toBe("https://cdn.test/pool.jpg");
    expect(downloadUrl.searchParams.get("name")).toBe("pool.jpg");
    expect(downloadUrl.searchParams.get("zone")).toBe("pool-zone");
    expect(displayUrl.pathname).toBe("/api/villas/88/images");
    expect(displayUrl.searchParams.get("url")).toBe("https://cdn.test/pool.jpg");
    expect(displayUrl.searchParams.get("w")).toBe("828");
    expect(displayUrl.searchParams.get("q")).toBe("60");
  });

  it("trims listing ids before building download paths", () => {
    const downloadUrl = new URL(
      buildGalleryDownloadHref(" 88 ", galleryItem()),
      "https://example.com",
    );

    expect(downloadUrl.pathname).toBe("/api/villas/88/images");
  });

  it("keeps image-id gallery proxy paths free of raw URL params", () => {
    const item = galleryItem({
      url: "/api/villas/88/images?imageId=7&url=https%3A%2F%2Fcdn.test%2Fraw.jpg&stale=1",
    });
    const downloadUrl = new URL(
      buildGalleryDownloadHref("88", item) ?? "",
      "https://example.com",
    );
    const displayUrl = new URL(
      buildGalleryDisplaySrc("88", item) ?? "",
      "https://example.com",
    );

    expect(downloadUrl.pathname).toBe("/api/villas/88/images");
    expect(downloadUrl.searchParams.get("imageId")).toBe("7");
    expect(downloadUrl.searchParams.get("download")).toBe("1");
    expect(downloadUrl.searchParams.has("url")).toBe(false);
    expect(downloadUrl.searchParams.has("stale")).toBe(false);
    expect(displayUrl.searchParams.get("imageId")).toBe("7");
    expect(displayUrl.searchParams.get("w")).toBe("828");
    expect(displayUrl.searchParams.get("q")).toBe("60");
    expect(displayUrl.searchParams.has("url")).toBe(false);
    expect(displayUrl.searchParams.has("stale")).toBe(false);
  });

  it("rejects unsafe display image URLs before proxying", () => {
    expect(normalizeGalleryDisplayImageUrl(" https://cdn.test/pool.jpg ")).toBe(
      "https://cdn.test/pool.jpg",
    );
    expect(normalizeGalleryDisplayImageUrl("http://cdn.test/pool.jpg")).toBeNull();
    expect(normalizeGalleryDisplayImageUrl("https://user:pass@cdn.test/pool.jpg")).toBeNull();
    expect(buildGalleryDisplaySrc("villa-1", galleryItem({ url: "http://cdn.test/a.jpg" }))).toBeNull();
    expect(buildGalleryDownloadHref("88", galleryItem({ url: "http://cdn.test/a.jpg" }))).toBeNull();
    expect(buildGalleryDownloadHref("   ", galleryItem())).toBeNull();
  });
});
