import { afterEach, describe, expect, it, vi } from "vitest";

import { buildSiteAssetStoragePath, uploadAsset } from "../admin-asset-uploads";

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
});
