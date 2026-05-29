import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/home-sections/validation", () => ({
  normalizeHouseId: (value: string) => {
    const trimmedValue = value.trim();

    return /^\d+$/.test(trimmedValue) ? trimmedValue : null;
  },
}));

import type { AdminSectionDraft } from "../types";
import { SectionOutcomePanel } from "../section-outcome-panel";

const section: AdminSectionDraft = {
  ctaEnabled: true,
  ctaHref: "/search",
  ctaLabel: "ดูเพิ่มเติม",
  description: "บ้านพักสำหรับหน้าแรก",
  displayOrder: 0,
  draftId: "draft-featured",
  fallbackMode: "fill_from_all",
  isActive: true,
  items: [{ houseId: "2938" }],
  limitCount: 12,
  mode: "manual",
  sliceOffset: 0,
  slug: "featured",
  title: "บ้านพักแนะนำ",
};

describe("SectionOutcomePanel", () => {
  it("summarizes verified manual villas without rendering each villa detail row", () => {
    const markup = renderToStaticMarkup(
      <SectionOutcomePanel
        onActiveChange={vi.fn()}
        preview={{
          invalidIds: [],
          missingIds: [],
          valid: [
            {
              amenities: [],
              bathrooms: 3,
              bedrooms: 3,
              coverImage: null,
              distanceToSea: "3 km",
              id: "2938",
              people: 6,
              poolType: "private",
              price: 9900,
              zone: "pattaya",
              zoneLabel: "พัทยา",
            },
          ],
        }}
        section={section}
      />,
    );

    expect(markup).toContain("พบบ้านพักที่ใช้ได้ 1 หลัง");
    expect(markup).not.toContain("#2938");
    expect(markup).not.toContain("พัทยา / 3 ห้องนอน / พักได้ 6 คน");
  });
});
