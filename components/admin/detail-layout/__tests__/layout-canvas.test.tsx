/**
 * @vitest-environment jsdom
 */
import type { ComponentProps } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_DETAIL_LAYOUT_V2 } from "../../../../lib/detail-layout/defaults";
import { toDetailLayoutV2Draft } from "../detail-layout-v2-helpers";
import type { DetailLayoutV2Draft } from "../types";
import {
  getDetailLayoutCanvasRowSortableIds,
  LayoutCanvas,
} from "../layout-canvas";

function renderCanvas(
  layout: DetailLayoutV2Draft = toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2),
  errorMessagesByTarget: Record<string, string[]> = {},
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
      errorMessagesByTarget={errorMessagesByTarget}
      onAddNarrowRow={vi.fn()}
      onAddWideRow={vi.fn()}
      onDropNarrowBlock={vi.fn()}
      onDropWideBlock={vi.fn()}
      onMoveNarrowBlock={vi.fn()}
      onMoveNarrowBlockToWide={vi.fn()}
      onMoveNarrowRow={vi.fn()}
      onMoveWideBlock={vi.fn()}
      onMoveWideBlockToNarrow={vi.fn()}
      onMoveWideRow={vi.fn()}
      onOuterRatioChange={vi.fn()}
      onRemoveNarrowBlock={vi.fn()}
      onRemoveNarrowRow={vi.fn()}
      onRemoveWideBlock={vi.fn()}
      onRemoveWideRow={vi.fn()}
      onSelectNarrowRow={vi.fn()}
      onSelectWideBlock={vi.fn()}
      onUpdateWideRow={vi.fn()}
    />,
  );
}


describe("LayoutCanvas", () => {
  it("renders only editable split zones without fixed placeholders", () => {
    const markup = renderCanvas();

    expect(markup).not.toContain("ล็อกไว้ด้านบน");
    expect(markup).not.toContain("ล็อกไว้ด้านล่าง");
    expect(markup).not.toContain("พื้นที่จัดหน้า");
    expect(markup).not.toContain("Gallery");
    expect(markup).not.toContain("รูปหลักและแกลเลอรีบ้านพัก");
    expect(markup).not.toContain("ชื่อบ้าน / ราคา");
    expect(markup).not.toContain("ข้อมูลเริ่มต้นและปุ่มติดต่อหลัก");
    expect(markup).toContain("ฝั่ง 70");
    expect(markup).toContain("ฝั่ง 30");
    expect(markup).not.toContain("บ้านพักแนะนำ");
    expect(markup).not.toContain("ส่วนเต็มความกว้าง");
    expect(markup).not.toContain("ล็อกเต็ม");
    expect(markup).not.toContain("ส่วนล็อก");
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

    expect(markup).toContain("ลากแถวที่ 1");
    expect(markup).not.toContain("แถวฝั่ง 70");
    expect(markup).not.toContain("แถวฝั่ง 30");
    expect(markup).toContain("min-h-11");
    expect(markup).toContain("touch-action:none");
  });

  it("lets existing wide and narrow block cards be dragged directly", () => {
    const markup = renderCanvas();

    expect(markup).toContain('aria-label="ลาก block รายละเอียดบ้านพัก"');
    expect(markup).toContain('aria-label="ลาก block จอง / ติดต่อ"');
    expect(markup).toContain("cursor-grab");
  });

  it("keeps sortable collections limited to rows", () => {
    const layout = toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2);
    const ids = getDetailLayoutCanvasRowSortableIds(layout);

    expect(ids).toContain(`wide-row:${layout.mainSplit.wideRows[0].id}`);
    expect(ids).toContain(`narrow-row:${layout.mainSplit.narrowRows[0].id}`);
    expect(ids).not.toContain(`wide-slot:${layout.mainSplit.wideRows[0].id}:0`);
    expect(ids).not.toContain(`wide-block:${layout.mainSplit.wideRows[0].id}:0`);
    expect(ids).not.toContain(`narrow-slot:${layout.mainSplit.narrowRows[0].id}`);
    expect(ids).not.toContain(`narrow-block:${layout.mainSplit.narrowRows[0].id}`);
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

  it("does not render retired row visibility controls or dim disabled rows", () => {
    const layout = toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2);
    layout.mainSplit.wideRows[0].enabled = false;
    layout.mainSplit.narrowRows[0].enabled = false;
    const markup = renderCanvas(layout);

    expect(markup).not.toContain("ปิดแถว");
    expect(markup).not.toContain("เปิดแถว");
    expect(markup).not.toContain("opacity-60");
  });

  it("renders multiple wide slots without React key warnings", async () => {
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
    const container = document.createElement("div");
    const root = createRoot(container);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await act(async () => {
        root.render(
          <LayoutCanvas
            activeSelection={null}
            layout={layout}
            errorMessagesByTarget={{}}
            onAddNarrowRow={vi.fn()}
            onAddWideRow={vi.fn()}
            onDropNarrowBlock={vi.fn()}
            onDropWideBlock={vi.fn()}
            onMoveNarrowBlock={vi.fn()}
            onMoveNarrowBlockToWide={vi.fn()}
            onMoveNarrowRow={vi.fn()}
            onMoveWideBlock={vi.fn()}
            onMoveWideBlockToNarrow={vi.fn()}
            onMoveWideRow={vi.fn()}
            onOuterRatioChange={vi.fn()}
            onRemoveNarrowBlock={vi.fn()}
            onRemoveNarrowRow={vi.fn()}
            onRemoveWideBlock={vi.fn()}
            onRemoveWideRow={vi.fn()}
            onSelectNarrowRow={vi.fn()}
            onSelectWideBlock={vi.fn()}
            onUpdateWideRow={vi.fn()}
          />,
        );
      });

      expect(
        consoleError.mock.calls.some((args) =>
          args.join(" ").includes('Each child in a list should have a unique "key" prop'),
        ),
      ).toBe(false);
    } finally {
      await act(async () => {
        root.unmount();
      });
      consoleError.mockRestore();
    }
  });

  it("shows validation errors next to the invalid layout slot", () => {
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
    const markup = renderCanvas(layout, {
      "wide_empty:slot:0": ["ช่องนี้ต้องใส่ block ก่อนบันทึก"],
    });

    expect(markup).toContain('data-detail-layout-error="true"');
    expect(markup).toContain("ช่องนี้ต้องใส่ block ก่อนบันทึก");
    expect(markup.indexOf("ช่องนี้ต้องใส่ block ก่อนบันทึก")).toBeGreaterThan(
      markup.indexOf("ลาก block ลงช่องนี้"),
    );
  });

  it("keeps wide-row validation errors below the row slots", () => {
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
    const markup = renderCanvas(layout, {
      "wide_empty:row": ["ฝั่ง 70 แถวที่ 1 ต้องมี block อย่างน้อย 1 รายการ"],
    });

    expect(
      markup.indexOf("ฝั่ง 70 แถวที่ 1 ต้องมี block อย่างน้อย 1 รายการ"),
    ).toBeGreaterThan(markup.indexOf("ลาก block ลงช่องนี้"));
  });

  it("renders a clear empty state for the narrow zone", () => {
    const layout = toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2);
    layout.mainSplit.narrowRows = [];
    const markup = renderCanvas(layout);

    expect(markup).toContain("ยังไม่มีแถวในฝั่ง 30");
    expect(markup).toContain("เพิ่มแถวสำหรับ block แนวตั้ง");
  });

});
