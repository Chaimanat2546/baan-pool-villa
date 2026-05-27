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
        "Section 1 CTA label is required when CTA is enabled.",
        "Section 1 CTA link must start with a single /.",
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
    ).toContain("Section 1 CTA link must start with a single /.");
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
        "Section 1 slice offset must be a safe non-negative integer.",
        "Section 2 slice offset must be a safe non-negative integer.",
        "Section 3 slice offset must be a safe non-negative integer.",
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
    ).toContain("Section 1 has duplicate house ID 66.");
  });

  it("validates section fields and duplicate slugs", () => {
    expect(
      validateHomeSectionDrafts([
        validDraft({
          slug: "Featured Villas",
          title: "",
          description: " ",
          mode: "other" as HomeSectionDraft["mode"],
          limitCount: 13,
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
        "Section 1 slug must be lowercase and URL-safe.",
        "Section 2 slug duplicates another section.",
        "Section 1 title is required.",
        "Section 1 description is required.",
        "Section 1 mode must be manual, near_sea, or slice.",
        "Section 1 limit count must be between 1 and 12.",
        "Section 1 fallback mode must be none, fill_from_all, or fill_near_sea.",
        "Section 3 item 1 has an invalid house ID.",
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
