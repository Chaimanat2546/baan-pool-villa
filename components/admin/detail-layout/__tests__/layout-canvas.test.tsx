import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_DETAIL_LAYOUT } from "../../../../lib/detail-layout/defaults";
import { cloneDetailLayout } from "../../../../lib/detail-layout/validation";

import { toDetailLayoutDraft } from "../detail-layout-helpers";
import type { DetailLayoutDraft } from "../types";
import { getDetailLayoutDropType, LayoutCanvas } from "../layout-canvas";

function renderCanvas(
  layout: DetailLayoutDraft = toDetailLayoutDraft(
    cloneDetailLayout(DEFAULT_DETAIL_LAYOUT),
  ),
) {
  return renderToStaticMarkup(
    <LayoutCanvas
      activeBlockIndex={0}
      activeRowId={DEFAULT_DETAIL_LAYOUT.rows[0]?.id ?? null}
      layout={layout}
      onDeleteRow={vi.fn()}
      onDropBlock={vi.fn()}
      onDuplicateRow={vi.fn()}
      onMoveRow={vi.fn()}
      onRemoveBlock={vi.fn()}
      onSelectBlock={vi.fn()}
      onSelectRow={vi.fn()}
      onToggleRowEnabled={vi.fn()}
    />,
  );
}

describe("LayoutCanvas", () => {
  it("renders locked top rows and default editable rows", () => {
    const markup = renderCanvas();

    expect(markup).toContain("แกลเลอรี");
    expect(markup).toContain("ข้อมูลเริ่มต้นบ้านพัก");
    expect(markup).toContain("รายละเอียดบ้านพัก");
    expect(markup).toContain("จอง / ติดต่อ");
  });

  it("shows row ratios and block remove controls", () => {
    const markup = renderCanvas();

    expect(markup).toContain("70/30");
    expect(markup).toContain("ลบ block");
  });

  it("marks every empty slot as a drop target", () => {
    const layout = toDetailLayoutDraft(cloneDetailLayout(DEFAULT_DETAIL_LAYOUT));
    layout.rows = [
      {
        id: "draft-empty",
        columns: 3,
        enabled: true,
        blocks: [null, null, null],
      },
    ];

    const markup = renderCanvas(layout);

    expect(markup.match(/ลาก block ลงช่องนี้/g)).toHaveLength(3);
    expect(markup).not.toContain("เติมช่องก่อนหน้า");
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
