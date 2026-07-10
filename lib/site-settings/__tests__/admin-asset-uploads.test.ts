import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildSiteAssetStoragePath,
  cleanupRetainedAssets,
  readSiteSettingsUploadFiles,
  uploadAsset,
} from "../admin-asset-uploads";

describe("admin site asset uploads", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("builds dated storage paths for supported image uploads", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T10:20:30Z"));
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(buildSiteAssetStoragePath("hero", "image/webp")).toBe(
      "hero/2026/06/11111111-1111-4111-8111-111111111111.webp",
    );
    expect(buildSiteAssetStoragePath("logo", "image/jpeg")).toBe(
      "logo/2026/06/11111111-1111-4111-8111-111111111111.jpg",
    );
    expect(buildSiteAssetStoragePath("favicon", "image/png")).toBe(
      "favicon/2026/06/11111111-1111-4111-8111-111111111111.png",
    );
    expect(() => buildSiteAssetStoragePath("logo", "image/gif")).toThrow(
      "Unsupported upload MIME type",
    );
  });

  it("returns structured errors for unsupported upload MIME types", async () => {
    const storage = {
      from: vi.fn(),
    };

    const result = await uploadAsset(
      { storage } as never,
      "logo",
      new File(["gif"], "logo.gif", { type: "image/gif" }),
    );

    expect(result.asset).toBeNull();
    expect(result.error?.message).toBe("Unsupported upload MIME type");
    expect(storage.from).not.toHaveBeenCalled();
  });

  it("reads favicon and SEO share image uploads from the settings form data", () => {
    const formData = new FormData();
    formData.set(
      "faviconFile",
      new File(["icon"], "icon.png", { type: "image/png" }),
    );
    formData.set(
      "seoOgImageFile",
      new File(["seo"], "seo.webp", { type: "image/webp" }),
    );
    formData.set(
      "searchSeoOgImageFile",
      new File(["search"], "search.webp", { type: "image/webp" }),
    );
    formData.set(
      "guidesSeoOgImageFile",
      new File(["guides"], "guides.webp", { type: "image/webp" }),
    );

    expect(readSiteSettingsUploadFiles(formData)).toMatchObject({
      errors: [],
      uploadFiles: [
        { assetType: "favicon" },
        { assetType: "seo-og" },
        { assetType: "search-seo-og" },
        { assetType: "guides-seo-og" },
      ],
    });
  });

  it("queries only Settings-owned upload types during retention cleanup", async () => {
    const rows = [
      {
        id: "current-logo",
        asset_type: "logo",
        storage_bucket: "site-assets",
        storage_path: "logo/2026/06/current.webp",
        is_current: true,
        created_at: "2026-06-01T00:00:00.000Z",
      },
      { asset_type: "villa-cover" },
      { asset_type: "customer-review" },
    ];
    const order = vi.fn();
    const inFilter = vi.fn((_column: string, values: string[]) => {
      order.mockResolvedValue({
        data: rows.filter((row) => values.includes(row.asset_type)),
        error: null,
      });
      return { order };
    });
    const select = vi.fn(() => ({ in: inFilter }));
    const supabase = {
      from: vi.fn(() => ({ select })),
      storage: { from: vi.fn() },
    } as never;

    await expect(cleanupRetainedAssets(supabase)).resolves.toEqual([]);
    expect(inFilter).toHaveBeenCalledWith("asset_type", [
      "favicon",
      "logo",
      "hero",
      "seo-og",
      "search-seo-og",
      "guides-seo-og",
    ]);
  });

  it("collapses identical cleanup warnings without hiding distinct warnings", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        { asset_type: "logo" },
        { asset_type: "hero" },
        {
          id: "unexpected-bucket",
          asset_type: "logo",
          storage_bucket: "other",
          storage_path: "logo/2026/06/file.webp",
          is_current: false,
          created_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ in: vi.fn(() => ({ order })) })),
      })),
      storage: { from: vi.fn() },
    } as never;

    await expect(cleanupRetainedAssets(supabase)).resolves.toEqual([
      "Skipped invalid site asset upload history row during cleanup.",
      "Skipped cleanup for logo upload with unexpected storage location.",
    ]);
  });
});
