import { describe, expect, it } from "vitest";

import type { HomeSectionDraft } from "../types";
import { moveHomeSectionDraft } from "../validation";

type OrderedHomeSectionDraft = HomeSectionDraft & {
  displayOrder: number;
};

const draft = (
  slug: string,
  displayOrder: number,
): OrderedHomeSectionDraft => ({
  slug,
  title: slug,
  description: `${slug} description`,
  mode: "manual",
  limitCount: 6,
  fallbackMode: "fill_from_all",
  sliceOffset: 0,
  isActive: true,
  ctaEnabled: false,
  ctaLabel: "",
  ctaHref: "",
  items: [],
  displayOrder,
});

describe("moveHomeSectionDraft", () => {
  it("moves a section and normalizes display order from the new index", () => {
    const movedSections = moveHomeSectionDraft(
      [draft("first", 10), draft("second", 20), draft("third", 30)],
      0,
      2,
    );

    expect(movedSections.map((section) => section.slug)).toEqual([
      "second",
      "third",
      "first",
    ]);
    expect(movedSections.map((section) => section.displayOrder)).toEqual([
      0,
      1,
      2,
    ]);
  });

  it("returns normalized current order when the source or target index is invalid", () => {
    const sections = [draft("first", 7), draft("second", 3)];

    expect(
      moveHomeSectionDraft(sections, -1, 1).map((section) => ({
        slug: section.slug,
        displayOrder: section.displayOrder,
      })),
    ).toEqual([
      { slug: "first", displayOrder: 0 },
      { slug: "second", displayOrder: 1 },
    ]);

    expect(
      moveHomeSectionDraft(sections, 0, 3).map((section) => ({
        slug: section.slug,
        displayOrder: section.displayOrder,
      })),
    ).toEqual([
      { slug: "first", displayOrder: 0 },
      { slug: "second", displayOrder: 1 },
    ]);
  });
});
