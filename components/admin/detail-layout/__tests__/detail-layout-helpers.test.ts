import { describe, expect, it } from "vitest";

import { DEFAULT_DETAIL_LAYOUT } from "../../../../lib/detail-layout/defaults";
import { cloneDetailLayout } from "../../../../lib/detail-layout/validation";

import {
  addDetailLayoutRow,
  getDetailLayoutBlockTargetSlot,
  isDetailLayoutBlockType,
  makeDetailLayoutBlock,
  makeDetailLayoutSnapshot,
  putDetailLayoutBlockInSlot,
  removeDetailLayoutBlock,
  toDetailLayoutDraft,
  validateDetailLayoutDraftForSave,
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
    const draft = toDetailLayoutDraft(DEFAULT_DETAIL_LAYOUT);
    const layout = addDetailLayoutRow(draft, 3);
    const lastRow = layout.rows.at(-1);

    expect(lastRow).toMatchObject({
      blocks: [null, null, null],
      columns: 3,
      enabled: true,
    });
    expect(lastRow?.ratio).toBeUndefined();
    expect(layout.rows).toHaveLength(DEFAULT_DETAIL_LAYOUT.rows.length + 1);
  });

  it("truncates overflow blocks when columns are reduced", () => {
    const row = DEFAULT_DETAIL_LAYOUT.rows[2];
    const layout = updateDetailLayoutRowColumns(
      toDetailLayoutDraft(DEFAULT_DETAIL_LAYOUT),
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
    const layout = removeDetailLayoutBlock(
      toDetailLayoutDraft(DEFAULT_DETAIL_LAYOUT),
      row.id,
      1,
    );
    const updatedRow = layout.rows.find((candidate) => candidate.id === row.id);

    expect(updatedRow?.blocks.map((block) => block?.type ?? null)).toEqual([
      "details",
      null,
    ]);
  });

  it("preserves a targeted later empty slot", () => {
    const row = DEFAULT_DETAIL_LAYOUT.rows[0];
    const draft = toDetailLayoutDraft(DEFAULT_DETAIL_LAYOUT);
    const layout = updateDetailLayoutRowColumns(draft, row.id, 3);
    const withoutBooking = removeDetailLayoutBlock(layout, row.id, 1);
    const updatedLayout = putDetailLayoutBlockInSlot(
      withoutBooking,
      row.id,
      2,
      makeDetailLayoutBlock("pool"),
    );
    const updatedRow = updatedLayout.rows.find(
      (candidate) => candidate.id === row.id,
    );

    expect(updatedRow?.blocks.map((block) => block?.type ?? null)).toEqual([
      "details",
      null,
      "pool",
    ]);
  });

  it("replaces an occupied slot without compacting later blocks", () => {
    const row = DEFAULT_DETAIL_LAYOUT.rows[0];
    const layout = putDetailLayoutBlockInSlot(
      toDetailLayoutDraft(DEFAULT_DETAIL_LAYOUT),
      row.id,
      0,
      makeDetailLayoutBlock("kitchen"),
    );
    const updatedRow = layout.rows.find((candidate) => candidate.id === row.id);

    expect(updatedRow?.blocks.map((block) => block?.type ?? null)).toEqual([
      "kitchen",
      "booking_contact",
    ]);
  });

  it("keeps booking contact visible even when content is empty", () => {
    expect(makeDetailLayoutBlock("booking_contact")).toMatchObject({
      enabled: true,
      hideWhenEmpty: false,
      title: "จอง / ติดต่อ",
      type: "booking_contact",
    });
  });

  it("sets a removed occupied slot to empty", () => {
    const row = DEFAULT_DETAIL_LAYOUT.rows[0];
    const layout = removeDetailLayoutBlock(
      toDetailLayoutDraft(DEFAULT_DETAIL_LAYOUT),
      row.id,
      0,
    );
    const updatedRow = layout.rows.find((candidate) => candidate.id === row.id);

    expect(updatedRow?.blocks.map((block) => block?.type ?? null)).toEqual([
      null,
      "booking_contact",
    ]);
  });

  it("reports a save error when an empty slot appears before a block", () => {
    const row = DEFAULT_DETAIL_LAYOUT.rows[0];
    const layout = removeDetailLayoutBlock(
      toDetailLayoutDraft(DEFAULT_DETAIL_LAYOUT),
      row.id,
      0,
    );

    expect(validateDetailLayoutDraftForSave(layout)).toEqual([
      "แถวที่ 1 มีช่องว่างก่อน block กรุณาเติมหรือลบ block ด้านหลัง",
    ]);
  });

  it("guards block types with an allowlist", () => {
    expect(isDetailLayoutBlockType("pool")).toBe(true);
    expect(isDetailLayoutBlockType("not_a_block")).toBe(false);
    expect(isDetailLayoutBlockType(null)).toBe(false);
  });

  it("prefers the selected empty slot for library block placement", () => {
    const row = updateDetailLayoutRowColumns(
      toDetailLayoutDraft(DEFAULT_DETAIL_LAYOUT),
      DEFAULT_DETAIL_LAYOUT.rows[0].id,
      3,
    ).rows[0];
    const layout = removeDetailLayoutBlock(
      {
        lockedTop: ["gallery", "intro"],
        rows: [row],
        version: 1,
      },
      row.id,
      1,
    );

    expect(getDetailLayoutBlockTargetSlot(layout.rows[0], 1)).toBe(1);
  });

  it("falls back to the first empty slot when selection is invalid", () => {
    const row = addDetailLayoutRow(
      toDetailLayoutDraft(DEFAULT_DETAIL_LAYOUT),
      3,
    ).rows.at(-1);

    if (!row) {
      throw new Error("Expected a draft row");
    }

    expect(getDetailLayoutBlockTargetSlot(row, 8)).toBe(0);
  });

  it("returns no target for a full row with a selected occupied slot", () => {
    const row = toDetailLayoutDraft(DEFAULT_DETAIL_LAYOUT).rows[0];

    expect(getDetailLayoutBlockTargetSlot(row, 0)).toBeNull();
  });

  it("falls back to the first empty slot when selection is occupied", () => {
    const row = updateDetailLayoutRowColumns(
      toDetailLayoutDraft(DEFAULT_DETAIL_LAYOUT),
      DEFAULT_DETAIL_LAYOUT.rows[0].id,
      3,
    ).rows[0];
    const layout = removeDetailLayoutBlock(
      {
        lockedTop: ["gallery", "intro"],
        rows: [row],
        version: 1,
      },
      row.id,
      2,
    );

    expect(getDetailLayoutBlockTargetSlot(layout.rows[0], 0)).toBe(2);
  });
});
