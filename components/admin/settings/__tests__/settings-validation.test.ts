import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";

import { mapSettingsToDraft } from "../settings-helpers";
import { validateAdminSettingsDraftForClient, validateBrandSettingsDraft, validateContactSettingsDraft, validateHeroSettingsDraft, validateSeoSettingsDraft, validateThemeSettingsDraft } from "../settings-validation";
import { mapContactSettingsResponse, mapSeoSettingsResponse } from "../settings-helpers";

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

describe("section settings validation", () => {
  it("validates brand without unrelated settings", () => {
    expect(validateBrandSettingsDraft({ siteName: " ", logoBackground: "white", logoFile: null, faviconFile: null, logoImage: DEFAULT_SITE_SETTINGS.logoImage, faviconImage: DEFAULT_SITE_SETTINGS.faviconImage })).toEqual(["ต้องใส่ชื่อเว็บ"]);
  });

  it("validates only the ten theme colors", () => {
    const draft = Object.fromEntries(["primaryColor", "accentColor", "headerLinkColor", "headerLinkHoverColor", "footerLinkColor", "footerLinkHoverColor", "bankHighlightColor", "bankAccountHighlightColor", "bankNameHighlightColor", "bankNumberHighlightColor"].map((key) => [key, DEFAULT_SITE_SETTINGS[key as keyof typeof DEFAULT_SITE_SETTINGS]])) as Parameters<typeof validateThemeSettingsDraft>[0];
    expect(validateThemeSettingsDraft({ ...draft, primaryColor: "bad" })).toEqual(["สีหลักต้องเป็นค่าสีแบบ #RRGGBB"]);
  });

  it("validates hero alt without unrelated settings", () => {
    expect(validateHeroSettingsDraft({ heroFile: null, heroImage: DEFAULT_SITE_SETTINGS.heroImage, heroImageAlt: "x".repeat(161) })).toEqual(["คำอธิบายรูป Hero ต้องไม่เกิน 160 ตัวอักษร"]);
  });

  it("validates every SEO group without unrelated settings", () => {
    const draft = mapSeoSettingsResponse({ settings: { seo: DEFAULT_SITE_SETTINGS.seo, pageSeo: DEFAULT_SITE_SETTINGS.pageSeo } });
    expect(validateSeoSettingsDraft({ ...draft, seoTitle: "x".repeat(81), searchSeoDescription: "" })).toEqual(expect.arrayContaining(["ชื่อหน้าที่แสดงบน Google ต้องไม่เกิน 80 ตัวอักษร", "ต้องใส่คำอธิบาย SEO ของหน้าค้นหา (/search)"]));
  });

  it("validates contact fields without unrelated settings", () => {
    const draft = mapContactSettingsResponse({ settings: { bank: DEFAULT_SITE_SETTINGS.bank, contact: DEFAULT_SITE_SETTINGS.contact } });
    expect(validateContactSettingsDraft({ ...draft, bankName: "", messengerUrl: "bad" })).toEqual(expect.arrayContaining(["ต้องใส่ชื่อธนาคาร", "ลิงก์ Messenger ต้องเป็น URL แบบ http หรือ https"]));
  });
});
