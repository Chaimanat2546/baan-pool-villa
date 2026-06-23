import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";

import { mapSettingsToDraft } from "../settings-helpers";
import { validateAdminSettingsDraftForClient } from "../settings-validation";

describe("validateAdminSettingsDraftForClient", () => {
  it("uses shared settings validation before the save request", () => {
    const errors = validateAdminSettingsDraftForClient({
      ...mapSettingsToDraft(DEFAULT_SITE_SETTINGS),
      messengerUrl: "not a url",
      siteName: " ",
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        "ต้องใส่ชื่อเว็บ",
        "ลิงก์ Messenger ต้องเป็น URL แบบ http หรือ https",
      ]),
    );
  });

  it("validates selected logo and hero files before upload", () => {
    const errors = validateAdminSettingsDraftForClient({
      ...mapSettingsToDraft(DEFAULT_SITE_SETTINGS),
      heroFile: new File(["x".repeat(7 * 1024 * 1024)], "hero.webp", {
        type: "image/webp",
      }),
      logoFile: new File(["logo"], "logo.gif", { type: "image/gif" }),
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        "ไฟล์โลโก้ต้องเป็น JPG, PNG หรือ WebP",
        "ไฟล์Heroต้องมีขนาดไม่เกิน 6MB",
      ]),
    );
  });

  it("validates selected SEO share image files before upload", () => {
    const errors = validateAdminSettingsDraftForClient({
      ...mapSettingsToDraft(DEFAULT_SITE_SETTINGS),
      seoOgImageFile: new File(["seo"], "seo.gif", { type: "image/gif" }),
      searchSeoOgImageFile: new File(
        ["x".repeat(7 * 1024 * 1024)],
        "search.webp",
        { type: "image/webp" },
      ),
      guidesSeoOgImageFile: null,
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        "ไฟล์รูปแชร์ SEO หน้าแรกต้องเป็น JPG, PNG หรือ WebP",
        "ไฟล์รูปแชร์ SEO หน้าค้นหาต้องมีขนาดไม่เกิน 6MB",
      ]),
    );
  });

  it("accepts a valid draft with no selected upload files", () => {
    expect(
      validateAdminSettingsDraftForClient(mapSettingsToDraft(DEFAULT_SITE_SETTINGS)),
    ).toEqual([]);
  });
});
