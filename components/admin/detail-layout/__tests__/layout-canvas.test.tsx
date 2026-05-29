import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_DETAIL_LAYOUT } from "../../../../lib/detail-layout/defaults";
import { cloneDetailLayout } from "../../../../lib/detail-layout/validation";

import {
  removeDetailLayoutBlock,
  toDetailLayoutDraft,
} from "../detail-layout-helpers";
import type { DetailLayoutDraft } from "../types";
import {
  getDetailLayoutBlockDragLocation,
  getDetailLayoutDropType,
  getDetailLayoutRowDragIndex,
  LayoutCanvas,
} from "../layout-canvas";

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
      onAddRow={vi.fn()}
      onDeleteRow={vi.fn()}
      onDropBlock={vi.fn()}
      onDuplicateRow={vi.fn()}
      onMoveRow={vi.fn()}
      onMoveBlock={vi.fn()}
      onCompactRow={vi.fn()}
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

  it("renders row drag handles for editable rows", () => {
    const markup = renderCanvas();

    expect(markup).toContain("ลากแถวที่ 1");
    expect(markup).toContain('draggable="true"');
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

  it("labels the selected empty slot as the next block target", () => {
    const layout = toDetailLayoutDraft(cloneDetailLayout(DEFAULT_DETAIL_LAYOUT));
    layout.rows = [
      {
        id: "draft-empty",
        columns: 2,
        enabled: true,
        blocks: [null, null],
      },
    ];
    const markup = renderToStaticMarkup(
      <LayoutCanvas
        activeBlockIndex={1}
        activeRowId="draft-empty"
        layout={layout}
        onAddRow={vi.fn()}
        onDeleteRow={vi.fn()}
        onDropBlock={vi.fn()}
        onDuplicateRow={vi.fn()}
        onMoveRow={vi.fn()}
        onMoveBlock={vi.fn()}
        onCompactRow={vi.fn()}
        onRemoveBlock={vi.fn()}
        onSelectBlock={vi.fn()}
        onSelectRow={vi.fn()}
        onToggleRowEnabled={vi.fn()}
      />,
    );

    expect(markup).toContain("ช่องนี้กำลังเลือก");
    expect(markup).toContain("กด block จากคลังเพื่อใส่ช่องนี้");
  });

  it("warns inline when a row has a gap before a block", () => {
    const row = DEFAULT_DETAIL_LAYOUT.rows[0];
    const layout = removeDetailLayoutBlock(
      toDetailLayoutDraft(cloneDetailLayout(DEFAULT_DETAIL_LAYOUT)),
      row.id,
      0,
    );
    const markup = renderCanvas(layout);

    expect(markup).toContain("มีช่องว่างก่อน block");
    expect(markup).toContain("จัด block ให้ชิดซ้าย");
  });

  it("renders draggable handles for blocks inside slots", () => {
    const markup = renderCanvas();

    expect(markup).toContain("ลาก block รายละเอียดบ้านพัก");
    expect(markup).toContain("ลาก block จอง / ติดต่อ");
  });

  it("labels split starts, 70-side flow rows, and locked recommendation rows", () => {
    const markup = renderCanvas();

    expect(markup).toContain('data-detail-layout-admin-row-role="split"');
    expect(markup).toContain("Split 70/30");
    expect(markup).toContain('data-detail-layout-admin-row-role="wide-flow"');
    expect(markup).toContain("อยู่ในฝั่ง 70");
    expect(markup).toContain(
      'data-detail-layout-admin-row-role="full-width-locked"',
    );
    expect(markup).toContain("ล็อกเต็มความกว้าง");
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

  it("reads row drag indexes only when they are valid for the row count", () => {
    const validTransfer = {
      getData: vi.fn(() => "2"),
    };
    const invalidTransfer = {
      getData: vi.fn(() => "not-an-index"),
    };
    const outOfRangeTransfer = {
      getData: vi.fn(() => "8"),
    };

    expect(getDetailLayoutRowDragIndex(validTransfer, 4)).toBe(2);
    expect(getDetailLayoutRowDragIndex(invalidTransfer, 4)).toBeNull();
    expect(getDetailLayoutRowDragIndex(outOfRangeTransfer, 4)).toBeNull();
  });

  it("reads block drag locations only when they match an existing slot", () => {
    const layout = toDetailLayoutDraft(cloneDetailLayout(DEFAULT_DETAIL_LAYOUT));
    const row = layout.rows[0];
    const validTransfer = {
      getData: vi.fn(() =>
        JSON.stringify({ blockIndex: 1, rowId: row.id }),
      ),
    };
    const invalidRowTransfer = {
      getData: vi.fn(() =>
        JSON.stringify({ blockIndex: 1, rowId: "missing-row" }),
      ),
    };
    const invalidIndexTransfer = {
      getData: vi.fn(() =>
        JSON.stringify({ blockIndex: 99, rowId: row.id }),
      ),
    };

    expect(getDetailLayoutBlockDragLocation(validTransfer, layout)).toEqual({
      blockIndex: 1,
      rowId: row.id,
    });
    expect(getDetailLayoutBlockDragLocation(invalidRowTransfer, layout)).toBeNull();
    expect(getDetailLayoutBlockDragLocation(invalidIndexTransfer, layout)).toBeNull();
  });
});
