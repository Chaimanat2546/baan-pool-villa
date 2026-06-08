import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/home-sections/validation", () => ({
  normalizeHouseId: (value: string) => {
    const trimmedValue = value.trim();

    return /^\d+$/.test(trimmedValue) ? trimmedValue : null;
  },
}));

import type { AdminSectionDraft } from "../types";
import { SectionHomePreview } from "../section-home-preview";

const baseSection: AdminSectionDraft = {
  ctaEnabled: true,
  ctaHref: "/search",
  ctaLabel: "ดูเพิ่มเติม",
  description: "บ้านยอดนิยมสำหรับครอบครัวและกลุ่มเพื่อน",
  displayOrder: 1,
  draftId: "draft-featured",
  fallbackMode: "fill_from_all",
  isActive: true,
  items: [{ houseId: "105", isActive: true }],
  limitCount: 6,
  mode: "manual",
  sliceOffset: 0,
  slug: "featured",
  title: "บ้านพักแนะนำ",
};

describe("SectionHomePreview", () => {
  it("renders a prototype homepage preview without real villa details", () => {
    const markup = renderToStaticMarkup(
      <SectionHomePreview
        preview={{
          invalidIds: [],
          missingIds: [],
          validIds: ["105"],
        }}
        section={baseSection}
      />,
    );

    expect(markup).toContain("ตัวอย่างจำลองบนหน้าแรก");
    expect(markup).toContain("ไม่ดึงรูป ราคา โซน จำนวนคน");
    expect(markup).toContain("บ้านพักแนะนำ");
    expect(markup).toContain("บ้านพักตัวอย่าง 1");
    expect(markup).toContain("#105");
    expect(markup).toContain("ตรวจพบเลขบ้านในระบบ");
    expect(markup).toContain("ดูเพิ่มเติม");
    expect(markup).not.toContain("พูลวิลล่า 105");
    expect(markup).not.toContain("จอมเทียน");
    expect(markup).not.toContain("Jomtien");
    expect(markup).not.toContain("8,900");
    expect(markup).not.toContain("10 คน");
    expect(markup).not.toContain("devillegroups.com");
  });

  it("shows draft placeholders when manual villas have not been verified yet", () => {
    const markup = renderToStaticMarkup(
      <SectionHomePreview preview={null} section={baseSection} />,
    );

    expect(markup).toContain("รอตรวจเลขบ้านจริง");
    expect(markup).toContain("#105");
    expect(markup).toContain("Prototype only");
  });

  it("shows missing and invalid villa ids inside the prototype preview", () => {
    const markup = renderToStaticMarkup(
      <SectionHomePreview
        preview={{
          invalidIds: ["abc"],
          missingIds: ["999"],
          validIds: [],
        }}
        section={baseSection}
      />,
    );

    expect(markup).toContain("เลขบ้านที่ไม่พบในระบบ");
    expect(markup).toContain("999");
    expect(markup).toContain("เลขบ้านที่รูปแบบไม่ถูกต้อง");
    expect(markup).toContain("abc");
    expect(markup).not.toContain("วิธีเติมบ้านเพิ่มตอนนี้");
  });
});
