import { describe, expect, it } from "vitest";

import type { HomeSectionConfig } from "../types";
import {
  buildFallbackHomeSections,
  resolveHomeSections,
} from "../resolve";
import type { VillaListing } from "../../villas/types";

const villa = (
  id: string,
  overrides: Partial<VillaListing> = {},
): VillaListing => ({
  id,
  zone: "pattaya",
  zoneLabel: "Pattaya",
  bedrooms: 3,
  bathrooms: 3,
  distanceToSea: "5 km",
  price: 12000,
  people: 8,
  coverImage: null,
  amenities: [],
  poolType: "private",
  ...overrides,
});

const config = (
  overrides: Partial<HomeSectionConfig> = {},
): HomeSectionConfig => ({
  slug: "featured",
  title: "Featured",
  description: "Featured villas",
  mode: "manual",
  fallbackMode: "none",
  sliceOffset: 0,
  isActive: true,
  limitCount: 3,
  displayOrder: 0,
  ctaLabel: null,
  ctaHref: null,
  ctaEnabled: false,
  items: [],
  ...overrides,
});

const item = (
  houseId: string,
  position: number,
  isActive = true,
): HomeSectionConfig["items"][number] => ({
  houseId,
  position,
  isActive,
});

const villas = [
  villa("1"),
  villa("2", { distanceToSea: "1.5 km" }),
  villa("3"),
  villa("4", { distanceToSea: "500 meter" }),
  villa("5"),
];

describe("resolveHomeSections", () => {
  it("sorts active sections, maps CTA fields, and skips inactive sections", () => {
    const sections = resolveHomeSections(
      [
        config({ slug: "hidden", isActive: false, displayOrder: 0 }),
        config({
          slug: "second",
          title: "Second",
          displayOrder: 2,
          mode: "slice",
          sliceOffset: 1,
          limitCount: 1,
          ctaEnabled: true,
          ctaLabel: "View all",
          ctaHref: "/search",
        }),
        config({
          slug: "first",
          title: "First",
          displayOrder: 1,
          mode: "slice",
          limitCount: 1,
          ctaEnabled: true,
          ctaLabel: "Missing href",
          ctaHref: null,
        }),
      ],
      villas,
    );

    expect(sections.map((section) => section.slug)).toEqual(["first", "second"]);
    expect(sections[0]).not.toHaveProperty("cta");
    expect(sections[1]).toMatchObject({
      slug: "second",
      title: "Second",
      cta: { label: "View all", href: "/search" },
    });
  });

  it("only maps CTA when it is enabled and label and href are present", () => {
    const sections = resolveHomeSections(
      [
        config({
          slug: "disabled-cta",
          mode: "slice",
          limitCount: 1,
          ctaEnabled: false,
          ctaLabel: "View villas",
          ctaHref: "/search",
        }),
        config({
          slug: "enabled-cta",
          mode: "slice",
          limitCount: 1,
          ctaEnabled: true,
          ctaLabel: "View villas",
          ctaHref: "/search",
          displayOrder: 1,
        }),
      ],
      villas,
    );

    expect(sections[0]).not.toHaveProperty("cta");
    expect(sections[1]).toMatchObject({
      cta: { label: "View villas", href: "/search" },
    });
  });

  it("rejects enabled CTA hrefs that are not internal links", () => {
    const sections = resolveHomeSections(
      [
        config({
          slug: "protocol-relative",
          mode: "slice",
          limitCount: 1,
          ctaEnabled: true,
          ctaLabel: "Bad link",
          ctaHref: "//example.com",
        }),
        config({
          slug: "javascript-link",
          mode: "slice",
          limitCount: 1,
          displayOrder: 1,
          ctaEnabled: true,
          ctaLabel: "Bad link",
          ctaHref: "javascript:alert(1)",
        }),
        config({
          slug: "query-hash",
          mode: "slice",
          limitCount: 1,
          displayOrder: 2,
          ctaEnabled: true,
          ctaLabel: "Good link",
          ctaHref: "/villas/123#gallery",
        }),
      ],
      villas,
    );

    expect(sections[0]).not.toHaveProperty("cta");
    expect(sections[1]).not.toHaveProperty("cta");
    expect(sections[2]).toMatchObject({
      cta: { label: "Good link", href: "/villas/123#gallery" },
    });
  });

  it("resolves manual sections in configured order, skipping missing and duplicate IDs", () => {
    const [section] = resolveHomeSections(
      [
        config({
          mode: "manual",
          limitCount: 2,
          items: [
            item("3", 2),
            item("404", 0),
            item("1", 1),
            item("5", 4, false),
            item("3", 3),
          ],
        }),
      ],
      villas,
    );

    expect(section.villas.map((item) => item.id)).toEqual(["1", "3"]);
  });

  it("fills manual sections from all listings without duplicating selected villas", () => {
    const [section] = resolveHomeSections(
      [
        config({
          mode: "manual",
          fallbackMode: "fill_from_all",
          limitCount: 4,
          items: [item("3", 0)],
        }),
      ],
      villas,
    );

    expect(section.villas.map((item) => item.id)).toEqual(["3", "1", "2", "4"]);
  });

  it("resolves near sea sections and fills from near sea listings", () => {
    const [section] = resolveHomeSections(
      [
        config({
          mode: "manual",
          fallbackMode: "fill_near_sea",
          limitCount: 3,
          items: [item("2", 0)],
        }),
      ],
      villas,
    );

    expect(section.villas.map((item) => item.id)).toEqual(["2", "4"]);

    const [nearSeaSection] = resolveHomeSections(
      [config({ mode: "near_sea", limitCount: 1 })],
      villas,
    );

    expect(nearSeaSection.villas.map((item) => item.id)).toEqual(["2"]);
  });

  it("resolves slice sections using offset and limit", () => {
    const [section] = resolveHomeSections(
      [config({ mode: "slice", sliceOffset: 2, limitCount: 2 })],
      villas,
    );

    expect(section.villas.map((item) => item.id)).toEqual(["3", "4"]);
  });

  it("normalizes invalid limits to 1 and honors large maximum display counts", () => {
    const manyVillas = Array.from({ length: 20 }, (_, index) =>
      villa(String(index + 1)),
    );

    const sections = resolveHomeSections(
      [
        config({
          slug: "nan-limit",
          mode: "manual",
          fallbackMode: "fill_from_all",
          limitCount: Number.NaN,
        }),
        config({
          slug: "large-limit",
          mode: "slice",
          limitCount: 99,
          displayOrder: 1,
        }),
      ],
      manyVillas,
    );

    expect(sections[0].villas.map((selectedVilla) => selectedVilla.id)).toEqual(["1"]);
    expect(sections[1].villas).toHaveLength(20);
  });

  it("does not dedupe villas across different sections", () => {
    const sections = resolveHomeSections(
      [
        config({ slug: "a", mode: "slice", limitCount: 1 }),
        config({ slug: "b", mode: "slice", limitCount: 1 }),
      ],
      villas,
    );

    expect(sections.map((section) => section.villas[0]?.id)).toEqual(["1", "1"]);
  });
});

describe("buildFallbackHomeSections", () => {
  it("matches the current homepage rails and omits empty sections", () => {
    const fallbackVillas = Array.from({ length: 24 }, (_, index) =>
      villa(String(index + 1), {
        distanceToSea: index === 13 ? "1 km" : "5 km",
      }),
    );

    const sections = buildFallbackHomeSections(fallbackVillas);

    expect(sections).toEqual([
      {
        slug: "featured",
        title: "บ้านพักแนะนำ",
        description:
          "พูลวิลล่าคัดพิเศษ เหมาะสำหรับครอบครัว กลุ่มเพื่อน และทริปพักผ่อนส่วนตัว",
        cta: { label: "ดูบ้านพักทั้งหมด", href: "/search" },
        villas: fallbackVillas.slice(0, 8),
      },
      {
        slug: "popular",
        title: "พูลวิลล่าพัทยายอดฮิต",
        description:
          "บ้านพักยอดนิยมสำหรับทริปพัทยา ใกล้แหล่งท่องเที่ยว เดินทางสะดวก และเหมาะกับกลุ่มเพื่อน",
        villas: fallbackVillas.slice(8, 16),
      },
      {
        slug: "near-sea",
        title: "บ้านพักใกล้ทะเล",
        description:
          "เลือกพูลวิลล่าใกล้ชายหาด เดินทางง่าย เหมาะกับคนที่อยากพักผ่อนใกล้ทะเล",
        villas: [fallbackVillas[13]],
      },
    ]);

    expect(buildFallbackHomeSections([])).toEqual([]);
  });
});
