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
  items: [{ houseId: "105" }],
  limitCount: 6,
  mode: "manual",
  sliceOffset: 0,
  slug: "featured",
  title: "บ้านพักแนะนำ",
};

describe("SectionHomePreview", () => {
  it("renders a homepage-style preview with the selected villas and call to action", () => {
    const markup = renderToStaticMarkup(
      <SectionHomePreview
        preview={{
          invalidIds: [],
          missingIds: [],
          valid: [
            {
              amenities: [],
              bathrooms: 3,
              bedrooms: 4,
              coverImage: "https://devillegroups.com/imgs/profile_imgs_large/105.jpg",
              distanceToSea: "500m",
              id: "105",
              people: 10,
              poolType: "private",
              price: 8900,
              zone: "jomtien",
              zoneLabel: "จอมเทียน",
            },
          ],
        }}
        section={baseSection}
      />,
    );

    expect(markup).toContain("ตัวอย่างบนหน้าแรก");
    expect(markup).toContain("บ้านพักแนะนำ");
    expect(markup).toContain("บ้านยอดนิยมสำหรับครอบครัวและกลุ่มเพื่อน");
    expect(markup).toContain("พูลวิลล่า 105");
    expect(markup).toContain("จอมเทียน");
    expect(markup).toContain("8,900");
    expect(markup).toContain("ดูเพิ่มเติม");
  });

  it("shows draft placeholders when manual villas have not been verified yet", () => {
    const markup = renderToStaticMarkup(
      <SectionHomePreview preview={null} section={baseSection} />,
    );

    expect(markup).toContain("รอเช็กบ้านจริง");
    expect(markup).toContain("#105");
  });
});
