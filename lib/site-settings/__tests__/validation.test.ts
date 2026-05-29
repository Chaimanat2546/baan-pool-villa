import { describe, expect, it } from "vitest";

import {
  DEFAULT_SITE_SETTINGS,
  SITE_SETTINGS_UPLOAD_LIMIT_BYTES,
} from "../defaults";
import {
  normalizeSiteSettingsDraft,
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
  bank_account_name: " คุณ อาภัสรา จินดาวา ",
  bank_name: " ธนาคารกสิกรไทย ",
  bank_account_number: " 398-289-7482 ",
  phone_contacts: [
    {
      name: " คุณเกม ",
      phone: " 0617485213 ",
      time: " ช่วง 07.00-15.00 ",
    },
  ],
  messenger_url: " https://www.facebook.com/baanpoolvillas ",
  line_id: " @baanpoolvilla ",
  line_url: " https://line.me/R/ti/p/@baanpoolvilla ",
};

describe("normalizeSiteSettingsRow", () => {
  it("returns defaults when the row is null", () => {
    expect(normalizeSiteSettingsRow(null)).toMatchObject({
      siteName: "Pool Villas Pattaya",
      primaryColor: "#064e3b",
      accentColor: "#eab308",
      logoImage: {
        url: "/images/logo.jpg",
      },
      heroImage: {
        url: "/images/BPV-66_Cover-Web.jpg",
      },
    });
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
      bank: {
        accountName: "คุณ อาภัสรา จินดาวา",
        bankName: "ธนาคารกสิกรไทย",
        accountNumber: "398-289-7482",
      },
      contact: {
        phoneContacts: [
          {
            name: "คุณเกม",
            phone: "0617485213",
            time: "ช่วง 07.00-15.00",
          },
        ],
        messengerUrl: "https://www.facebook.com/baanpoolvillas",
        lineId: "@baanpoolvilla",
        lineUrl: "https://line.me/R/ti/p/@baanpoolvilla",
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
        bank_account_name: "",
        bank_name: "",
        bank_account_number: "",
        phone_contacts: [],
        messenger_url: "javascript:alert(1)",
        line_id: "",
        line_url: "ftp://example.com/line",
      }),
    ).toEqual(DEFAULT_SITE_SETTINGS);
  });
});

describe("normalizeSiteSettingsDraft", () => {
  it("trims text fields and lowercases colors", () => {
    expect(
      normalizeSiteSettingsDraft({
        siteName: " Baan Pool Villa ",
        primaryColor: " #064E3B ",
        accentColor: " #EAB308 ",
        heroImageAlt: " Pool villas in Pattaya ",
        bankAccountName: " คุณ อาภัสรา จินดาวา ",
        bankName: " ธนาคารกสิกรไทย ",
        bankAccountNumber: " 398-289-7482 ",
        phoneContacts: [
          {
            name: " คุณเกม ",
            phone: " 061-748-5213 ",
            time: " ช่วง 07.00-15.00 ",
          },
        ],
        messengerUrl: " https://www.facebook.com/baanpoolvillas ",
        lineId: " @baanpoolvilla ",
        lineUrl: " https://line.me/R/ti/p/@baanpoolvilla ",
      }),
    ).toEqual({
      siteName: "Baan Pool Villa",
      primaryColor: "#064e3b",
      accentColor: "#eab308",
      heroImageAlt: "Pool villas in Pattaya",
      bankAccountName: "คุณ อาภัสรา จินดาวา",
      bankName: "ธนาคารกสิกรไทย",
      bankAccountNumber: "398-289-7482",
      phoneContacts: [
        {
          name: "คุณเกม",
          phone: "061-748-5213",
          time: "ช่วง 07.00-15.00",
        },
      ],
      messengerUrl: "https://www.facebook.com/baanpoolvillas",
      lineId: "@baanpoolvilla",
      lineUrl: "https://line.me/R/ti/p/@baanpoolvilla",
    });
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
        bankAccountName: "คุณ อาภัสรา จินดาวา",
        bankName: "ธนาคารกสิกรไทย",
        bankAccountNumber: "398-289-7482",
        phoneContacts: [
          {
            name: "คุณเกม",
            phone: "0617485213",
            time: "ช่วง 07.00-15.00",
          },
        ],
        messengerUrl: "https://www.facebook.com/baanpoolvillas",
        lineId: "@baanpoolvilla",
        lineUrl: "https://line.me/R/ti/p/@baanpoolvilla",
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
        bankAccountName: "",
        bankName: "",
        bankAccountNumber: "",
        phoneContacts: [
          {
            name: "",
            phone: "",
            time: "",
          },
        ],
        messengerUrl: "not a url",
        lineId: "",
        lineUrl: "javascript:alert(1)",
      }),
    ).toEqual([
      "ต้องใส่ชื่อเว็บ",
      "สีหลักต้องเป็นค่าสีแบบ #RRGGBB",
      "สีเน้นต้องเป็นค่าสีแบบ #RRGGBB",
      "คำอธิบายรูป Hero ต้องไม่เกิน 160 ตัวอักษร",
      "ต้องใส่ชื่อบัญชีธนาคาร",
      "ต้องใส่ชื่อธนาคาร",
      "ต้องใส่เลขบัญชีธนาคาร",
      "ต้องใส่ชื่อผู้ติดต่อคนที่ 1",
      "ต้องใส่เบอร์โทรผู้ติดต่อคนที่ 1",
      "ต้องใส่ช่วงเวลาผู้ติดต่อคนที่ 1",
      "ลิงก์ Messenger ต้องเป็น URL แบบ http หรือ https",
      "ต้องใส่ LINE ID",
      "ลิงก์ LINE ต้องเป็น URL แบบ http หรือ https",
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
