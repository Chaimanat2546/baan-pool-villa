import { describe, expect, it } from "vitest";

import {
  DEFAULT_SITE_SETTINGS,
  SITE_SETTINGS_UPLOAD_LIMIT_BYTES,
} from "../defaults";
import {
  normalizeSiteSettingsRow,
  validateSiteSettingsDraft,
  validateUploadMetadata,
} from "../validation";

const validRow = {
  id: "global",
  site_name: " Baan Pool Villa ",
  primary_color: "#123456",
  accent_color: "#abcdef",
  logo_image_path: "logo/2026/05/logo.webp",
  logo_image_url:
    "https://example.supabase.co/storage/v1/object/public/site-assets/logo/2026/05/logo.webp",
  hero_image_path: "hero/2026/05/hero.webp",
  hero_image_url:
    "https://example.supabase.co/storage/v1/object/public/site-assets/hero/2026/05/hero.webp",
  hero_image_alt: " พูลวิลล่าพัทยา ",
};

describe("normalizeSiteSettingsRow", () => {
  it("returns defaults when the row is null", () => {
    expect(normalizeSiteSettingsRow(null)).toEqual(DEFAULT_SITE_SETTINGS);
  });

  it("normalizes a valid database row", () => {
    expect(normalizeSiteSettingsRow(validRow)).toEqual({
      siteName: "Baan Pool Villa",
      primaryColor: "#123456",
      accentColor: "#abcdef",
      logoImage: {
        path: "logo/2026/05/logo.webp",
        url: "https://example.supabase.co/storage/v1/object/public/site-assets/logo/2026/05/logo.webp",
        alt: "Baan Pool Villa logo",
      },
      heroImage: {
        path: "hero/2026/05/hero.webp",
        url: "https://example.supabase.co/storage/v1/object/public/site-assets/hero/2026/05/hero.webp",
        alt: "พูลวิลล่าพัทยา",
      },
    });
  });

  it("falls back for malformed colors and missing images", () => {
    expect(
      normalizeSiteSettingsRow({
        id: "global",
        site_name: "",
        primary_color: "green",
        accent_color: "#12345",
        logo_image_path: null,
        logo_image_url: null,
        hero_image_path: null,
        hero_image_url: null,
        hero_image_alt: "",
      }),
    ).toEqual(DEFAULT_SITE_SETTINGS);
  });
});

describe("validateSiteSettingsDraft", () => {
  it("accepts valid settings text", () => {
    expect(
      validateSiteSettingsDraft({
        siteName: "Baan Pool Villa",
        primaryColor: "#064e3b",
        accentColor: "#eab308",
        heroImageAlt: "พูลวิลล่าพัทยา",
      }),
    ).toEqual([]);
  });

  it("rejects empty names, malformed colors, and long alt text", () => {
    expect(
      validateSiteSettingsDraft({
        siteName: " ",
        primaryColor: "064e3b",
        accentColor: "#gggggg",
        heroImageAlt: "x".repeat(161),
      }),
    ).toEqual([
      "ต้องใส่ชื่อเว็บ",
      "สีหลักต้องเป็นค่าสีแบบ #RRGGBB",
      "สีเน้นต้องเป็นค่าสีแบบ #RRGGBB",
      "คำอธิบายรูป Hero ต้องไม่เกิน 160 ตัวอักษร",
    ]);
  });
});

describe("validateUploadMetadata", () => {
  it("accepts configured image mime types under the size limit", () => {
    expect(
      validateUploadMetadata(
        "hero",
        "image/webp",
        SITE_SETTINGS_UPLOAD_LIMIT_BYTES,
      ),
    ).toEqual([]);
  });

  it("rejects unsupported file types and oversized files", () => {
    expect(
      validateUploadMetadata(
        "logo",
        "image/gif",
        SITE_SETTINGS_UPLOAD_LIMIT_BYTES + 1,
      ),
    ).toEqual([
      "ไฟล์โลโก้ต้องเป็น JPG, PNG หรือ WebP",
      "ไฟล์โลโก้ต้องมีขนาดไม่เกิน 6MB",
    ]);
  });
});
