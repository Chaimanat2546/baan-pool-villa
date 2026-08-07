import { describe, expect, it } from "vitest";

import {
  makeNewSection,
  mapResponseHomePageConfig,
  mapResponseSections,
  parseManualIds,
} from "../section-draft-helpers";

const layout = [
  { kind: "fixed" as const, key: "why_choose" as const, enabled: true },
  { kind: "rail" as const, key: "featured", enabled: false },
  { kind: "fixed" as const, key: "tiktok" as const, enabled: true },
  { kind: "rail" as const, key: "near-sea", enabled: true },
  { kind: "fixed" as const, key: "customer_reviews" as const, enabled: true },
  { kind: "fixed" as const, key: "articles" as const, enabled: true },
  { kind: "fixed" as const, key: "faq" as const, enabled: true },
  { kind: "fixed" as const, key: "contact" as const, enabled: true },
];

describe("section draft helpers", () => {
  it("keeps existing draft ids while mapping saved sections", () => {
    const sections = mapResponseSections(
      {
        layout,
        sections: [
          {
            autoScrollEnabled: false,
            ctaEnabled: false,
            ctaHref: "",
            ctaLabel: "",
            description: "",
            displayOrder: 1,
            fallbackMode: "unexpected" as "fill_from_all",
            isActive: true,
            items: [{ houseId: "102", isActive: true, position: undefined }],
            limitCount: 6,
            mode: "manual",
            sliceOffset: 0,
            slug: "manual",
            title: "Manual",
          },
          {
            autoScrollEnabled: false,
            ctaEnabled: false,
            ctaHref: "",
            ctaLabel: "",
            description: "",
            displayOrder: 0,
            fallbackMode: "fill_from_all",
            isActive: true,
            items: [],
            limitCount: 6,
            mode: "slice",
            sliceOffset: 0,
            slug: "featured",
            title: "Featured",
          },
        ],
      },
      [
        {
          autoScrollEnabled: false,
          ctaEnabled: false,
          ctaHref: "",
          ctaLabel: "",
          description: "",
          displayOrder: 0,
          draftId: "keep-featured",
          fallbackMode: "fill_from_all",
          isActive: true,
          isNew: false,
          items: [],
          limitCount: 6,
          mode: "slice",
          sliceOffset: 0,
          slug: "featured",
          title: "Featured",
        },
      ],
    );

    expect(sections[0]?.draftId).toBe("keep-featured");
    expect(sections[0]?.displayOrder).toBe(0);
    expect(sections[1]?.displayOrder).toBe(1);
    expect(sections[1]?.fallbackMode).toBe("none");
    expect(sections[1]?.items).toEqual([
      { houseId: "102", isActive: true, position: 0 },
    ]);
    expect(sections.every((section) => section.isNew === false)).toBe(true);
  });

  it("keeps draft ids by slug while mapping the saved homepage configuration", () => {
    const config = mapResponseHomePageConfig(
      {
        layout,
        sections: [
          {
            autoScrollEnabled: false,
            ctaEnabled: false,
            ctaHref: "",
            ctaLabel: "",
            description: "",
            displayOrder: 0,
            fallbackMode: "fill_from_all",
            isActive: true,
            items: [],
            limitCount: 6,
            mode: "slice",
            sliceOffset: 0,
            slug: "featured",
            title: "Featured",
          },
          {
            autoScrollEnabled: false,
            ctaEnabled: false,
            ctaHref: "",
            ctaLabel: "",
            description: "",
            displayOrder: 1,
            fallbackMode: "fill_from_all",
            isActive: true,
            items: [],
            limitCount: 6,
            mode: "near_sea",
            sliceOffset: 0,
            slug: "near-sea",
            title: "Near sea",
          },
        ],
      },
      [
        {
          autoScrollEnabled: false,
          ctaEnabled: false,
          ctaHref: "",
          ctaLabel: "",
          description: "",
          displayOrder: 0,
          draftId: "keep-featured",
          fallbackMode: "fill_from_all",
          isActive: true,
          isNew: false,
          items: [],
          limitCount: 6,
          mode: "slice",
          sliceOffset: 0,
          slug: "featured",
          title: "Featured",
        },
      ],
    );

    expect(config.layout).toEqual(layout);
    expect(config.sections).toMatchObject([
      { draftId: "keep-featured", isNew: false, slug: "featured" },
      { isNew: false, slug: "near-sea" },
    ]);
  });

  it("creates unique new slugs and parses manual ids", () => {
    const nextSection = makeNewSection([
      {
        autoScrollEnabled: false,
        ctaEnabled: false,
        ctaHref: "",
        ctaLabel: "",
        description: "",
        displayOrder: 0,
        draftId: "draft-1",
        fallbackMode: "fill_from_all",
        isActive: true,
        isNew: false,
        items: [],
        limitCount: 6,
        mode: "slice",
        sliceOffset: 0,
        slug: "new-section-2",
        title: "Existing",
      },
    ]);

    expect(nextSection.slug).toBe("new-section-3");
    expect(nextSection.isNew).toBe(true);
    expect(parseManualIds("101, 102; 103\n")).toEqual([
      { houseId: "101", isActive: true },
      { houseId: "102", isActive: true },
      { houseId: "103", isActive: true },
    ]);
  });
});
