import { describe, expect, it } from "vitest";

import type { GuideDraft } from "../types";
import {
  buildUniqueSlug,
  createSlugFromTitle,
  normalizeGuideDraftForSave,
  normalizeGuideHouseId,
  validateGuideDraft,
  validateGuideUploadMetadata,
} from "../validation";

const validDraft = (overrides: Partial<GuideDraft> = {}): GuideDraft => ({
  title: "บ้านพักพูลวิลล่าพัทยาสำหรับครอบครัวใหญ่",
  slug: "baan-pak-pool-villa-pattaya",
  excerpt: "เลือกบ้านที่มีพื้นที่ส่วนกลางกว้างและเดินทางง่าย",
  coverImage: {
    alt: "บ้านพักพูลวิลล่าพัทยาสำหรับครอบครัว",
    path: "guides/2026/06/family-villa.webp",
    url: "https://example.supabase.co/storage/v1/object/public/guide-assets/guides/2026/06/family-villa.webp",
  },
  contentBlocks: [
    {
      id: "intro",
      type: "paragraph",
      props: {},
      content: [{ type: "text", text: "เริ่มจากจำนวนคนและงบประมาณ", styles: {} }],
      children: [],
    },
  ],
  tags: ["ครอบครัว", "พัทยา"],
  recommendedHouseIds: ["DV-66", "102"],
  status: "draft",
  isPinned: false,
  publishedAt: null,
  ...overrides,
});

describe("createSlugFromTitle", () => {
  it("creates readable slugs from Thai and English article titles", () => {
    expect(createSlugFromTitle(" 5 เทคนิคเลือก Pool Villa Pattaya สำหรับครอบครัว ")).toBe(
      "5-เทคนิคเลือก-pool-villa-pattaya-สำหรับครอบครัว",
    );
  });

  it("falls back when the title has no slug-safe characters", () => {
    expect(createSlugFromTitle(" !!! ")).toBe("guide-draft");
  });
});

describe("buildUniqueSlug", () => {
  it("appends the next numeric suffix when a slug already exists", () => {
    expect(
      buildUniqueSlug("pool-villa-pattaya", [
        "pool-villa-pattaya",
        "pool-villa-pattaya-2",
      ]),
    ).toBe("pool-villa-pattaya-3");
  });

  it("ignores the current article slug while editing", () => {
    expect(
      buildUniqueSlug("pool-villa-pattaya", ["pool-villa-pattaya"], "pool-villa-pattaya"),
    ).toBe("pool-villa-pattaya");
  });
});

describe("normalizeGuideHouseId", () => {
  it.each([
    ["66", "66"],
    ["DV-66", "66"],
    ["BPV-66", "66"],
    [" bpv 102 ", "102"],
  ])("normalizes %s to %s", (value, expected) => {
    expect(normalizeGuideHouseId(value)).toBe(expected);
  });

  it.each(["", "0", "-1", "abc", "66.5"])("rejects %s", (value) => {
    expect(normalizeGuideHouseId(value)).toBeNull();
  });
});

describe("validateGuideDraft", () => {
  it("accepts a complete draft article", () => {
    expect(validateGuideDraft(validDraft())).toEqual([]);
  });

  it("validates required editorial fields and publish readiness", () => {
    expect(
      validateGuideDraft(
        validDraft({
          title: " ",
          excerpt: " ",
          coverImage: null,
          contentBlocks: [],
          status: "published",
          tags: [],
          recommendedHouseIds: [],
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        "ต้องใส่ชื่อบทความ",
        "ต้องใส่คำโปรยบทความ",
        "บทความที่เผยแพร่ต้องมีรูปปก",
        "บทความที่เผยแพร่ต้องมีเนื้อหาอย่างน้อย 1 บล็อก",
        "ควรใส่แท็กอย่างน้อย 1 แท็ก",
        "บทความที่ช่วยปิดการจองควรเลือกบ้านพักแนะนำอย่างน้อย 1 หลัง",
      ]),
    );
  });

  it("detects duplicate recommended villa IDs after normalization", () => {
    expect(
      validateGuideDraft(
        validDraft({
          recommendedHouseIds: ["DV-66", "BPV 66", "102"],
        }),
      ),
    ).toContain("มีรหัสบ้านพัก 66 ซ้ำ");
  });

  it("rejects invalid image URLs and overly long alt text", () => {
    expect(
      validateGuideDraft(
        validDraft({
          coverImage: {
            alt: "x".repeat(181),
            path: "guides/cover.webp",
            url: "javascript:alert(1)",
          },
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        "ลิงก์รูปปกต้องเป็น URL แบบ http, https หรือ path ภายในเว็บที่ขึ้นต้นด้วย /",
        "คำอธิบายรูปปกต้องไม่เกิน 180 ตัวอักษร",
      ]),
    );
  });
});

describe("normalizeGuideDraftForSave", () => {
  it("trims fields, dedupes tags, and normalizes recommended villa IDs", () => {
    expect(
      normalizeGuideDraftForSave(
        validDraft({
          title: " บ้านพักพูลวิลล่าพัทยา ",
          slug: " pool-villa-pattaya ",
          excerpt: " เหมาะกับครอบครัว ",
          tags: [" พัทยา ", "ครอบครัว", "พัทยา", " "],
          recommendedHouseIds: ["DV-66", "BPV 66", "102"],
          isPinned: true,
          status: "published",
        }),
      ),
    ).toMatchObject({
      title: "บ้านพักพูลวิลล่าพัทยา",
      slug: "pool-villa-pattaya",
      excerpt: "เหมาะกับครอบครัว",
      tags: ["พัทยา", "ครอบครัว"],
      recommendedHouseIds: ["66", "102"],
      isPinned: true,
      status: "published",
    });
  });
});

describe("validateGuideUploadMetadata", () => {
  it("accepts configured image mime types under the size limit", () => {
    expect(validateGuideUploadMetadata("image/webp", 3 * 1024 * 1024)).toEqual([]);
  });

  it("rejects unsupported file types and oversized images", () => {
    expect(validateGuideUploadMetadata("image/gif", 8 * 1024 * 1024)).toEqual([
      "รูปบทความต้องเป็น JPG, PNG หรือ WebP",
      "รูปบทความต้องมีขนาดไม่เกิน 6MB",
    ]);
  });
});
