import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_DETAIL_LAYOUT } from "../../../../lib/detail-layout/defaults";
import { cloneDetailLayout } from "../../../../lib/detail-layout/validation";

import { LayoutCanvas } from "../layout-canvas";

function renderCanvas() {
  return renderToStaticMarkup(
    <LayoutCanvas
      activeBlockIndex={0}
      activeRowId={DEFAULT_DETAIL_LAYOUT.rows[0]?.id ?? null}
      layout={cloneDetailLayout(DEFAULT_DETAIL_LAYOUT)}
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
});
