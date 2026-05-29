import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_DETAIL_LAYOUT_V2 } from "../../../../lib/detail-layout/defaults";
import { toDetailLayoutV2Draft } from "../detail-layout-v2-helpers";
import type { DetailLayoutCanvasSelection } from "../layout-canvas";
import { RowSettingsPanel } from "../row-settings-panel";

function renderPanel(selection: DetailLayoutCanvasSelection) {
  return renderToStaticMarkup(
    <RowSettingsPanel
      layout={toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2)}
      onRemoveNarrowBlock={vi.fn()}
      onRemoveWideBlock={vi.fn()}
      onSelectWideBlock={vi.fn()}
      onUpdateNarrowBlock={vi.fn()}
      onUpdateNarrowRow={vi.fn()}
      onUpdateWideBlock={vi.fn()}
      onUpdateWideRow={vi.fn()}
      onUpdateWideRowEnabled={vi.fn()}
      selection={selection}
    />,
  );
}

describe("RowSettingsPanel", () => {
  it("shows wide-zone settings with wide-only ratios", () => {
    const layout = toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2);
    const row = layout.mainSplit.wideRows[0];
    const markup = renderPanel({
      zone: "wide",
      rowId: row.id,
      blockIndex: 0,
    });

    expect(markup).toContain("ฝั่ง 70 / แถว 1");
    expect(markup).toContain("รูปแบบแถว");
    expect(markup).toContain("1 คอลัมน์");
    expect(markup).toContain("50/50");
    expect(markup).toContain("60/40");
    expect(markup).toContain("40/60");
    expect(markup).not.toContain("70/30");
    expect(markup).not.toContain("30/70");
  });

  it("shows narrow-zone settings without ratio controls", () => {
    const layout = toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2);
    const row = layout.mainSplit.narrowRows[0];
    const markup = renderPanel({ zone: "narrow", rowId: row.id });

    expect(markup).toContain("ฝั่ง 30 / ลำดับ 1");
    expect(markup).toContain("เปิดใช้แถว");
    expect(markup).not.toContain("รูปแบบแถว");
    expect(markup).not.toContain("สัดส่วนคอลัมน์");
  });

  it("explains that recommended villas are locked full width", () => {
    const markup = renderPanel({ zone: "lockedBottom", blockIndex: 0 });

    expect(markup).toContain("บ้านพักแนะนำ: ล็อกเต็มความกว้าง");
    expect(markup).toContain("ถูกล็อกไว้ด้านล่าง");
    expect(markup).toContain("ไม่มีการแก้แถวหรือเพิ่ม block");
  });
});
