import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_DETAIL_LAYOUT } from "../../../../lib/detail-layout/defaults";
import { toDetailLayoutDraft } from "../detail-layout-helpers";
import { RowSettingsPanel } from "../row-settings-panel";
import type { DetailLayoutDraftRow } from "../types";

function renderPanel(row: DetailLayoutDraftRow | null) {
  return renderToStaticMarkup(
    <RowSettingsPanel
      activeBlockIndex={0}
      row={row}
      onRemoveBlock={vi.fn()}
      onSelectBlock={vi.fn()}
      onUpdateBlock={vi.fn()}
      onUpdateColumns={vi.fn()}
      onUpdateRow={vi.fn()}
    />,
  );
}

describe("RowSettingsPanel", () => {
  it("explains 70/30 split rows in the admin settings panel", () => {
    const row = toDetailLayoutDraft(DEFAULT_DETAIL_LAYOUT).rows[0];
    const markup = renderPanel(row);

    expect(markup).toContain("ฝั่ง 70 อยู่ซ้าย");
    expect(markup).toContain("ฝั่ง 30 อยู่ขวา");
  });

  it("explains swapped 30/70 split rows in the admin settings panel", () => {
    const row = {
      ...toDetailLayoutDraft(DEFAULT_DETAIL_LAYOUT).rows[0],
      ratio: "30/70",
    } satisfies DetailLayoutDraftRow;
    const markup = renderPanel(row);

    expect(markup).toContain("ฝั่ง 30 อยู่ซ้าย");
    expect(markup).toContain("ฝั่ง 70 อยู่ขวา");
  });

  it("explains that recommended villas are locked full width", () => {
    const row = toDetailLayoutDraft(DEFAULT_DETAIL_LAYOUT).rows.at(-1) ?? null;
    const markup = renderPanel(row);

    expect(markup).toContain("ล็อกเต็มความกว้าง");
    expect(markup).toContain("บ้านพักแนะนำ");
  });
});
