import { describe, expect, it } from "vitest";

import {
  makeNewSection,
  mapResponseSections,
  parseManualIds,
} from "../section-draft-helpers";

describe("section draft helpers", () => {
  it("keeps existing draft ids while mapping saved sections", () => {
    const sections = mapResponseSections(
      {
        sections: [
          {
            ctaEnabled: false,
            ctaHref: "",
            ctaLabel: "",
            description: "",
            displayOrder: 1,
            fallbackMode: "unexpected" as "fill_from_all",
            isActive: true,
            items: [{ houseId: "102", isActive: undefined, position: undefined }],
            limitCount: 6,
            mode: "manual",
            sliceOffset: 0,
            slug: "manual",
            title: "Manual",
          },
          {
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
          ctaEnabled: false,
          ctaHref: "",
          ctaLabel: "",
          description: "",
          displayOrder: 0,
          draftId: "keep-featured",
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
    );

    expect(sections[0]?.draftId).toBe("keep-featured");
    expect(sections[0]?.displayOrder).toBe(0);
    expect(sections[1]?.displayOrder).toBe(1);
    expect(sections[1]?.fallbackMode).toBe("none");
    expect(sections[1]?.items).toEqual([
      { houseId: "102", isActive: true, position: 0 },
    ]);
  });

  it("creates unique new slugs and parses manual ids", () => {
    const nextSection = makeNewSection([
      {
        ctaEnabled: false,
        ctaHref: "",
        ctaLabel: "",
        description: "",
        displayOrder: 0,
        draftId: "draft-1",
        fallbackMode: "fill_from_all",
        isActive: true,
        items: [],
        limitCount: 6,
        mode: "slice",
        sliceOffset: 0,
        slug: "new-section-2",
        title: "Existing",
      },
    ]);

    expect(nextSection.slug).toBe("new-section-3");
    expect(parseManualIds("101, 102; 103\n")).toEqual([
      { houseId: "101", isActive: true },
      { houseId: "102", isActive: true },
      { houseId: "103", isActive: true },
    ]);
  });
});
