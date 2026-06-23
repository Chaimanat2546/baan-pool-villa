import { describe, expect, it } from "vitest";

import type { SiteAssetUploadRecord } from "../types";
import { selectAssetUploadsForCleanup } from "../validation";

function upload(
  id: string,
  assetType: SiteAssetUploadRecord["assetType"],
  day: number,
  isCurrent = false,
): SiteAssetUploadRecord {
  return {
    assetType,
    id,
    isCurrent,
    storageBucket: "site-assets",
    storagePath: `${assetType}/2026/05/${id}.webp`,
    createdAt: `2026-05-${String(day).padStart(2, "0")}T00:00:00.000Z`,
  };
}

describe("selectAssetUploadsForCleanup", () => {
  it("keeps the latest 3 per asset type and never deletes current uploads", () => {
    const records = [
      upload("hero-1", "hero", 1),
      upload("hero-2", "hero", 2),
      upload("hero-3", "hero", 3),
      upload("hero-4", "hero", 4, true),
      upload("logo-1", "logo", 1),
      upload("logo-2", "logo", 2),
      upload("logo-3", "logo", 3),
      upload("logo-4", "logo", 4, true),
    ];

    expect(selectAssetUploadsForCleanup(records).map((record) => record.id)).toEqual([
      "hero-1",
      "logo-1",
    ]);
  });

  it("keeps a current old upload even when it is older than the latest 3", () => {
    const records = [
      upload("hero-current", "hero", 1, true),
      upload("hero-2", "hero", 2),
      upload("hero-3", "hero", 3),
      upload("hero-4", "hero", 4),
      upload("hero-5", "hero", 5),
    ];

    expect(selectAssetUploadsForCleanup(records).map((record) => record.id)).toEqual([
      "hero-2",
    ]);
  });

  it("applies retention to SEO share image uploads", () => {
    const records = [
      upload("seo-og-1", "seo-og", 1),
      upload("seo-og-2", "seo-og", 2),
      upload("seo-og-3", "seo-og", 3),
      upload("seo-og-4", "seo-og", 4, true),
    ];

    expect(selectAssetUploadsForCleanup(records).map((record) => record.id)).toEqual([
      "seo-og-1",
    ]);
  });
});
