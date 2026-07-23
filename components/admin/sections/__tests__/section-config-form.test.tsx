import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/home-sections/validation", () => ({
  normalizeHouseId: (value: string) => {
    const trimmedValue = value.trim();

    return /^\d+$/.test(trimmedValue) ? trimmedValue : null;
  },
}));

import type { AdminSectionDraft } from "../types";
import { SectionConfigForm } from "../section-config-form";

const section: AdminSectionDraft = {
  ctaEnabled: false,
  ctaHref: "",
  ctaLabel: "",
  description: "บ้านพักสำหรับหน้าแรก",
  displayOrder: 0,
  draftId: "draft-featured",
  fallbackMode: "fill_from_all",
  isActive: true,
  isNew: false,
  items: [],
  limitCount: 24,
  mode: "slice",
  sliceOffset: 0,
  slug: "featured",
  title: "บ้านพักแนะนำ",
};

describe("SectionConfigForm", () => {
  it("lets admins enter a maximum display count without a fixed 12-home cap", () => {
    const markup = renderToStaticMarkup(
      <SectionConfigForm onChange={vi.fn()} section={section} />,
    );

    expect(markup).toContain("จำนวนบ้านสูงสุดที่แสดง");
    expect(markup).not.toContain('max="12"');
    expect(markup).not.toContain("แสดงบ้านพักได้ 1-12 หลัง");
  });
});
