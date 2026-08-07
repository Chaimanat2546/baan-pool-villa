import { describe, expect, it } from "vitest";

import { makeHomePageConfigSnapshot } from "@/components/admin/sections/section-draft-helpers";

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
  autoScrollEnabled: false,
  items: [],
  displayOrder,
});

describe("moveHomeSectionDraft", () => {
  it("snapshots rails by their relative order while preserving the mixed layout", () => {
    const layout = [
      { kind: "fixed" as const, key: "why_choose" as const, enabled: true },
      { kind: "rail" as const, key: "second", enabled: false },
      { kind: "fixed" as const, key: "tiktok" as const, enabled: true },
      { kind: "rail" as const, key: "first", enabled: true },
      { kind: "fixed" as const, key: "customer_reviews" as const, enabled: true },
      { kind: "fixed" as const, key: "articles" as const, enabled: true },
      { kind: "fixed" as const, key: "faq" as const, enabled: true },
      { kind: "fixed" as const, key: "contact" as const, enabled: true },
    ];
    const snapshot = makeHomePageConfigSnapshot(layout, [
      { ...draft("first", 0), draftId: "first", isNew: false },
      { ...draft("second", 1), draftId: "second", isNew: false },
    ]);

    expect(snapshot.layout).toEqual(layout);
    expect(snapshot.sections).toMatchObject([
      { slug: "second", isActive: false },
      { slug: "first", isActive: true },
    ]);
    expect(snapshot.sections.map((section) => section.displayOrder)).toEqual([
      0,
      1,
    ]);
  });

  it("rejects a layout rail without a matching draft", () => {
    const layout = [
      { kind: "rail" as const, key: "missing", enabled: true },
    ];

    expect(() => makeHomePageConfigSnapshot(layout, [])).toThrow(
      "Missing draft for layout rail: missing",
    );
  });

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
