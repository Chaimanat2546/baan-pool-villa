import { describe, expect, it } from "vitest";

import type { HomeSectionDraft } from "../types";
import {
  normalizeHomeSectionDraftsForSave,
  normalizeHouseId,
  validateHomeSectionDrafts,
} from "../validation";

const validDraft = (overrides: Partial<HomeSectionDraft> = {}): HomeSectionDraft => ({
  slug: "near-sea-villas",
  title: "Near sea villas",
  description: "Great homes close to the beach.",
  mode: "manual",
  limitCount: 6,
  fallbackMode: "fill_from_all",
  sliceOffset: 0,
  isActive: true,
  ctaEnabled: false,
  ctaLabel: "",
  ctaHref: "",
  items: [
    { houseId: "DV-66" },
    { houseId: "25" },
  ],
  ...overrides,
});

describe("normalizeHouseId", () => {
  it.each([
    ["66", "66"],
    ["DV-66", "66"],
    ["dv66", "66"],
    [" DV 66 ", "66"],
  ])("normalizes %s to %s", (value, expected) => {
    expect(normalizeHouseId(value)).toBe(expected);
  });

  it.each(["", " ", "DV-", "0", "-1", "abc", "66.5"])("rejects %s", (value) => {
    expect(normalizeHouseId(value)).toBeNull();
  });
});

describe("validateHomeSectionDrafts", () => {
  it("requires CTA label and an internal href when CTA is enabled", () => {
    expect(
      validateHomeSectionDrafts([
        validDraft({
          ctaEnabled: true,
          ctaLabel: " ",
          ctaHref: "https://example.com/villas",
        }),
      ]),
    ).toEqual(
      expect.arrayContaining([
        "ชุดที่ 1 ต้องมีข้อความบนปุ่มดูเพิ่มเติม",
        "ชุดที่ 1 ลิงก์ปุ่มดูเพิ่มเติมต้องขึ้นต้นด้วย /",
      ]),
    );
  });

  it("rejects protocol-relative CTA hrefs", () => {
    expect(
      validateHomeSectionDrafts([
        validDraft({
          ctaEnabled: true,
          ctaLabel: "View villas",
          ctaHref: "//example.com",
        }),
      ]),
    ).toContain("ชุดที่ 1 ลิงก์ปุ่มดูเพิ่มเติมต้องขึ้นต้นด้วย /");
  });

  it("allows internal CTA hrefs with query strings and hashes", () => {
    expect(
      validateHomeSectionDrafts([
        validDraft({
          ctaEnabled: true,
          ctaLabel: "Search",
          ctaHref: "/search?nearSea=1",
        }),
        validDraft({
          slug: "villa-gallery",
          ctaEnabled: true,
          ctaLabel: "Gallery",
          ctaHref: "/villas/123#gallery",
        }),
      ]),
    ).toEqual([]);
  });

  it("rejects negative, fractional, and NaN slice offsets", () => {
    expect(
      validateHomeSectionDrafts([
        validDraft({ sliceOffset: -1 }),
        validDraft({ slug: "fractional-offset", sliceOffset: 1.5 }),
        validDraft({ slug: "nan-offset", sliceOffset: Number.NaN }),
      ]),
    ).toEqual(
      expect.arrayContaining([
        "ชุดที่ 1 ลำดับเริ่มต้นต้องเป็นเลข 0 ขึ้นไป",
        "ชุดที่ 2 ลำดับเริ่มต้นต้องเป็นเลข 0 ขึ้นไป",
        "ชุดที่ 3 ลำดับเริ่มต้นต้องเป็นเลข 0 ขึ้นไป",
      ]),
    );
  });

  it("detects duplicate manual house IDs after normalization", () => {
    expect(
      validateHomeSectionDrafts([
        validDraft({
          items: [{ houseId: "DV-66" }, { houseId: "dv66" }],
        }),
      ]),
    ).toContain("ชุดที่ 1 มีเลขบ้าน 66 ซ้ำ");
  });

  it("allows large positive maximum display counts", () => {
    expect(validateHomeSectionDrafts([validDraft({ limitCount: 99 })])).toEqual(
      [],
    );
  });

  it("validates section fields and duplicate slugs", () => {
    expect(
      validateHomeSectionDrafts([
        validDraft({
          slug: "Featured Villas",
          title: "",
          description: " ",
          mode: "other" as HomeSectionDraft["mode"],
          limitCount: 0,
          fallbackMode: "all" as HomeSectionDraft["fallbackMode"],
        }),
        validDraft({ slug: "Featured Villas" }),
        validDraft({
          slug: "manual-invalid-id",
          items: [{ houseId: "66.5" }],
        }),
      ]),
    ).toEqual(
      expect.arrayContaining([
        "ชุดที่ 1 รหัสชุดต้องเป็นภาษาอังกฤษตัวเล็ก ตัวเลข หรือขีดกลางเท่านั้น",
        "ชุดที่ 2 รหัสชุดซ้ำกับชุดอื่น",
        "ชุดที่ 1 ต้องมีชื่อชุดบ้านพัก",
        "ชุดที่ 1 ต้องมีคำอธิบาย",
        "ชุดที่ 1 รูปแบบการเลือกบ้านไม่ถูกต้อง",
        "ชุดที่ 1 จำนวนบ้านสูงสุดที่แสดงต้องเป็นเลขตั้งแต่ 1 ขึ้นไป",
        "ชุดที่ 1 วิธีเติมบ้านเมื่อจำนวนไม่ครบไม่ถูกต้อง",
        "ชุดที่ 3 เลขบ้านลำดับที่ 1 ไม่ถูกต้อง",
      ]),
    );
  });
});

describe("normalizeHomeSectionDraftsForSave", () => {
  it("trims section fields and normalizes manual items for saving", () => {
    expect(
      normalizeHomeSectionDraftsForSave([
        validDraft({
          slug: " featured-villas ",
          title: " Featured villas ",
          description: " Hand-picked villas. ",
          mode: "manual",
          fallbackMode: "fill_near_sea",
          sliceOffset: 3,
          isActive: false,
          limitCount: 2,
          ctaEnabled: false,
          ctaLabel: "See villas",
          ctaHref: "/search",
          items: [{ houseId: "DV-66" }, { houseId: "25" }],
        }),
      ]),
    ).toEqual([
      {
        slug: "featured-villas",
        title: "Featured villas",
        description: "Hand-picked villas.",
        mode: "manual",
        fallbackMode: "fill_near_sea",
        sliceOffset: 3,
        isActive: false,
        limitCount: 2,
        display_order: 0,
        ctaLabel: null,
        ctaHref: null,
        items: [
          { houseId: "66", position: 0 },
          { houseId: "25", position: 1 },
        ],
      },
    ]);
  });
});
