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
  it("builds download URLs and keeps safe gallery display sources raw", () => {
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
    expect(displayUrl.toString()).toBe("https://cdn.test/pool.jpg");
  });

  it("trims listing ids before building download paths", () => {
    const downloadUrl = new URL(
      buildGalleryDownloadHref(" 88 ", galleryItem()),
      "https://example.com",
    );

    expect(downloadUrl.pathname).toBe("/api/villas/88/images");
  });

  it("keeps legacy image-id gallery proxy paths free of raw URL params", () => {
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

  it("renders the resolved cover proxy for the current villa", () => {
    const cover = galleryItem({
      isCover: true,
      url: "/api/houses/images/2970",
      zone: "cover",
    });

    expect(buildGalleryDisplaySrc("2970", cover)).toBe(
      "/api/houses/images/2970?w=828&q=60",
    );
    expect(buildGalleryDisplaySrc("88", cover)).toBeNull();
    expect(buildGalleryDownloadHref("2970", cover)).toBe(
      "/api/villas/2970/images/download?cover=1",
    );
  });

  it("rejects unsafe display image URLs before rendering", () => {
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
