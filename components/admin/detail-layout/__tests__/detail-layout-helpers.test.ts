import { describe, expect, it } from "vitest";

import { DEFAULT_DETAIL_LAYOUT } from "../../../../lib/detail-layout/defaults";
import { cloneDetailLayout } from "../../../../lib/detail-layout/validation";

import {
  addDetailLayoutRow,
  makeDetailLayoutBlock,
  makeDetailLayoutSnapshot,
  removeDetailLayoutBlock,
  updateDetailLayoutRowColumns,
} from "../detail-layout-helpers";

describe("detail layout helpers", () => {
  it("makes a stable snapshot for unchanged layout data", () => {
    const first = cloneDetailLayout(DEFAULT_DETAIL_LAYOUT);
    const second = cloneDetailLayout(DEFAULT_DETAIL_LAYOUT);

    expect(makeDetailLayoutSnapshot(first)).toBe(
      makeDetailLayoutSnapshot(second),
    );
  });

  it("adds a draft row with the requested column count", () => {
    const layout = addDetailLayoutRow(DEFAULT_DETAIL_LAYOUT, 3);
    const lastRow = layout.rows.at(-1);

    expect(lastRow).toMatchObject({
      blocks: [],
      columns: 3,
      enabled: true,
    });
    expect(lastRow?.ratio).toBeUndefined();
    expect(layout.rows).toHaveLength(DEFAULT_DETAIL_LAYOUT.rows.length + 1);
  });

  it("truncates overflow blocks when columns are reduced", () => {
    const row = DEFAULT_DETAIL_LAYOUT.rows[2];
    const layout = updateDetailLayoutRowColumns(
      DEFAULT_DETAIL_LAYOUT,
      row.id,
      2,
      "70/30",
    );
    const updatedRow = layout.rows.find((candidate) => candidate.id === row.id);

    expect(updatedRow?.blocks).toHaveLength(2);
    expect(updatedRow?.ratio).toBe("70/30");
  });

  it("removes a block from a row", () => {
    const row = DEFAULT_DETAIL_LAYOUT.rows[0];
    const layout = removeDetailLayoutBlock(DEFAULT_DETAIL_LAYOUT, row.id, 1);
    const updatedRow = layout.rows.find((candidate) => candidate.id === row.id);

    expect(updatedRow?.blocks).toHaveLength(1);
    expect(updatedRow?.blocks[0]?.type).toBe("details");
  });

  it("keeps booking contact visible even when content is empty", () => {
    expect(makeDetailLayoutBlock("booking_contact")).toMatchObject({
      enabled: true,
      hideWhenEmpty: false,
      title: "จอง / ติดต่อ",
      type: "booking_contact",
    });
  });
});
