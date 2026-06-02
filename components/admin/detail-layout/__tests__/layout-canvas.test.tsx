import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_DETAIL_LAYOUT_V2 } from "../../../../lib/detail-layout/defaults";
import { toDetailLayoutV2Draft } from "../detail-layout-v2-helpers";
import type { DetailLayoutV2Draft } from "../types";
import { getDetailLayoutDropType, LayoutCanvas } from "../layout-canvas";

function renderCanvas(
  layout: DetailLayoutV2Draft = toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2),
) {
  const firstWideRow = layout.mainSplit.wideRows[0];

  return renderToStaticMarkup(
    <LayoutCanvas
      activeSelection={
        firstWideRow
          ? { zone: "wide", rowId: firstWideRow.id, blockIndex: 0 }
          : null
      }
      layout={layout}
      onAddNarrowRow={vi.fn()}
      onAddWideRow={vi.fn()}
      onDropNarrowBlock={vi.fn()}
      onDropWideBlock={vi.fn()}
      onMoveNarrowRow={vi.fn()}
      onMoveWideBlock={vi.fn()}
      onMoveWideRow={vi.fn()}
      onOuterRatioChange={vi.fn()}
      onRemoveNarrowBlock={vi.fn()}
      onRemoveNarrowRow={vi.fn()}
      onRemoveWideBlock={vi.fn()}
      onRemoveWideRow={vi.fn()}
      onSelectLockedBottomBlock={vi.fn()}
      onSelectNarrowRow={vi.fn()}
      onSelectWideBlock={vi.fn()}
      onToggleNarrowRow={vi.fn()}
      onToggleWideRow={vi.fn()}
      onUpdateWideRow={vi.fn()}
    />,
  );
}

describe("LayoutCanvas", () => {
  it("renders locked top, split zones, and locked recommended villas", () => {
    const markup = renderCanvas();

    expect(markup).toContain("ล็อกไว้ด้านบน");
    expect(markup).toContain("Gallery");
    expect(markup).toContain("ชื่อบ้าน / ราคา");
    expect(markup).toContain("ฝั่ง 70");
    expect(markup).toContain("ฝั่ง 30");
    expect(markup).toContain("บ้านพักแนะนำ");
    expect(markup).toContain("ล็อกเต็มความกว้าง");
  });

  it("shows outer split controls and wide-only row ratio choices", () => {
    const markup = renderCanvas();

    expect(markup).toContain("70 ซ้าย / 30 ขวา");
    expect(markup).toContain("30 ซ้าย / 70 ขวา");
    expect(markup).toContain("1 ช่อง");
    expect(markup).toContain("2 ช่อง");
    expect(markup).not.toContain("60/40");
    expect(markup).not.toContain("40/60");
  });

  it("keeps the public 70/30 split stacked until wide admin viewports", () => {
    const markup = renderCanvas();

    expect(markup).toContain("xl:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]");
    expect(markup).not.toContain("lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]");
  });

  it("marks wide and narrow row drag handles", () => {
    const markup = renderCanvas();

    expect(markup).toContain("ลากแถวฝั่ง 70 ลำดับที่ 1");
    expect(markup).toContain("ลากแถวฝั่ง 30 ลำดับที่ 1");
    expect(markup).toContain('draggable="true"');
  });

  it("marks every empty wide slot as a drop target", () => {
    const layout = toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2);
    layout.mainSplit.wideRows = [
      {
        id: "wide_empty",
        columns: 2,
        enabled: true,
        ratio: "50/50",
        blocks: [null, null],
      },
    ];
    const markup = renderCanvas(layout);

    expect(markup).toContain("ช่องนี้กำลังเลือก");
    expect(markup).toContain("ลาก block ลงช่องนี้");
  });

  it("renders a clear empty state for the narrow zone", () => {
    const layout = toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2);
    layout.mainSplit.narrowRows = [];
    const markup = renderCanvas(layout);

    expect(markup).toContain("ยังไม่มีแถวในฝั่ง 30");
    expect(markup).toContain("เพิ่มแถวสำหรับ block แนวตั้ง");
  });

  it("ignores invalid dragged block payloads", () => {
    const invalidTransfer = {
      getData: vi.fn(() => "not_a_block"),
    };
    const validTransfer = {
      getData: vi.fn(() => "pool"),
    };

    expect(getDetailLayoutDropType(invalidTransfer)).toBeNull();
    expect(getDetailLayoutDropType(validTransfer)).toBe("pool");
  });

});
