import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { BlockLibrary } from "../block-library";

describe("BlockLibrary", () => {
  it("shows a short workflow and the active target before adding blocks", () => {
    const markup = renderToStaticMarkup(
      <BlockLibrary
        onAddBlock={vi.fn()}
        onDragStart={vi.fn()}
        targetLabel="ฝั่ง 70 / แถว 1 / ช่องซ้าย"
        usedBlockTypes={[]}
      />,
    );

    expect(markup).toContain("ลำดับการทำงาน");
    expect(markup).toContain("เลือกช่องในผัง");
    expect(markup).toContain("เพิ่มหรือวาง block");
    expect(markup).toContain("ฝั่ง 70 / แถว 1 / ช่องซ้าย");
    expect(markup).not.toContain("max-h-[420px]");
    expect(markup).not.toContain("overflow-y-auto");
  });

  it("hides block types that are already used", () => {
    const markup = renderToStaticMarkup(
      <BlockLibrary
        onAddBlock={vi.fn()}
        onDragStart={vi.fn()}
        targetLabel="ฝั่ง 70 / แถว 1 / ช่องซ้าย"
        usedBlockTypes={["rules_pet_policy"]}
      />,
    );

    expect(markup).not.toContain("กฎและสัตว์เลี้ยง");
    expect(markup).toContain("แผนที่และสถานที่ใกล้เคียง");
  });

  it("shows an empty state when every block type is already used", () => {
    const markup = renderToStaticMarkup(
      <BlockLibrary
        onAddBlock={vi.fn()}
        onDragStart={vi.fn()}
        targetLabel="ฝั่ง 70 / แถว 1 / ช่องซ้าย"
        usedBlockTypes={[
          "details",
          "bedrooms",
          "pool",
          "kitchen",
          "amenities",
          "categorized_images",
          "costs_promotions",
          "rules_pet_policy",
          "advertisements",
          "map_nearby",
          "review_videos",
          "booking_contact",
          "recommended_villas",
        ]}
      />,
    );

    expect(markup).toContain("ใช้ block ครบแล้ว");
  });
});
