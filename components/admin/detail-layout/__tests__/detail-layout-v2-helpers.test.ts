import { describe, expect, it } from "vitest";

import {
  DEFAULT_DETAIL_LAYOUT,
  DEFAULT_DETAIL_LAYOUT_V2,
} from "../../../../lib/detail-layout/defaults";
import { validateDetailLayoutV2 } from "../../../../lib/detail-layout/version-2";
import { makeDetailLayoutBlock } from "../detail-layout-helpers";
import {
  addDetailLayoutV2NarrowRow,
  addDetailLayoutV2WideRow,
  makeDetailLayoutV2Snapshot,
  moveDetailLayoutV2NarrowBlockToWideSlot,
  moveDetailLayoutV2NarrowRow,
  moveDetailLayoutV2WideBlock,
  moveDetailLayoutV2WideBlockToNarrowRow,
  moveDetailLayoutV2WideRow,
  putDetailLayoutV2NarrowBlock,
  putDetailLayoutV2WideBlockInSlot,
  removeDetailLayoutV2WideBlock,
  toDetailLayoutV2Config,
  toDetailLayoutV2Draft,
  updateDetailLayoutV2OuterRatio,
  updateDetailLayoutV2WideRowColumns,
  validateDetailLayoutV2DraftForSaveDetails,
  validateDetailLayoutV2DraftForSave,
} from "../detail-layout-v2-helpers";

describe("detail layout V2 helpers", () => {
  it("converts V1 layout data into a V2 draft with wide, narrow, and locked bottom areas", () => {
    const draft = toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT);

    expect(draft.version).toBe(2);
    expect(draft.mainSplit.ratio).toBe("70/30");
    expect(draft.mainSplit.wideRows[0].blocks[0]?.type).toBe("details");
    expect(draft.mainSplit.narrowRows[0].block?.type).toBe("booking_contact");
    expect(draft.lockedBottom[0].type).toBe("recommended_villas");
  });

  it("adds and resizes wide rows with the supported internal ratio", () => {
    const draft = toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2);
    const added = addDetailLayoutV2WideRow(draft, 2, "50/50");
    const addedRow = added.mainSplit.wideRows.at(-1);

    expect(addedRow).toMatchObject({
      blocks: [null, null],
      columns: 2,
      enabled: true,
      ratio: "50/50",
    });

    if (!addedRow) {
      throw new Error("Expected a wide draft row");
    }

    const resized = updateDetailLayoutV2WideRowColumns(added, addedRow.id, 1);
    const resizedRow = resized.mainSplit.wideRows.find(
      (row) => row.id === addedRow.id,
    );

    expect(resizedRow?.blocks).toEqual([null]);
    expect(resizedRow?.ratio).toBeUndefined();
  });

  it("puts and removes blocks in wide row slots without compacting the row", () => {
    const draft = addDetailLayoutV2WideRow(
      toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2),
      2,
      "50/50",
    );
    const row = draft.mainSplit.wideRows.at(-1);

    if (!row) {
      throw new Error("Expected a wide draft row");
    }

    const withBlock = putDetailLayoutV2WideBlockInSlot(
      draft,
      row.id,
      1,
      makeDetailLayoutBlock("pool"),
    );

    expect(
      withBlock.mainSplit.wideRows.at(-1)?.blocks.map(
        (block) => block?.type ?? null,
      ),
    ).toEqual([null, "pool"]);
    expect(validateDetailLayoutV2DraftForSave(withBlock)).toContain(
      "ฝั่ง 70 แถวที่ 5 มีช่องว่างก่อน block กรุณาเติมหรือลบ block ด้านหลัง",
    );
    expect(validateDetailLayoutV2DraftForSaveDetails(withBlock)).toContainEqual({
      message:
        "ฝั่ง 70 แถวที่ 5 มีช่องว่างก่อน block กรุณาเติมหรือลบ block ด้านหลัง",
      target: `${row.id}:slot:0`,
    });

    const removed = removeDetailLayoutV2WideBlock(withBlock, row.id, 1);

    expect(
      removed.mainSplit.wideRows.at(-1)?.blocks.map(
        (block) => block?.type ?? null,
      ),
    ).toEqual([null, null]);
  });

  it("moves blocks between wide and narrow zones without dropping the overwritten block", () => {
    const draft = addDetailLayoutV2WideRow(
      toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2),
      2,
      "50/50",
    );
    const wideRow = draft.mainSplit.wideRows.at(-1);

    if (!wideRow) {
      throw new Error("Expected a wide draft row");
    }

    const withWideBlocks = putDetailLayoutV2WideBlockInSlot(
      putDetailLayoutV2WideBlockInSlot(
        draft,
        wideRow.id,
        0,
        makeDetailLayoutBlock("pool"),
      ),
      wideRow.id,
      1,
      makeDetailLayoutBlock("kitchen"),
    );
    const withNarrowRow = addDetailLayoutV2NarrowRow(
      withWideBlocks,
      makeDetailLayoutBlock("map_nearby"),
    );
    const narrowRow = withNarrowRow.mainSplit.narrowRows.at(-1);

    if (!narrowRow) {
      throw new Error("Expected a narrow draft row");
    }

    const swappedWide = moveDetailLayoutV2WideBlock(
      withNarrowRow,
      wideRow.id,
      0,
      wideRow.id,
      1,
    );

    expect(
      swappedWide.mainSplit.wideRows.at(-1)?.blocks.map(
        (block) => block?.type ?? null,
      ),
    ).toEqual(["kitchen", "pool"]);

    const movedToNarrow = moveDetailLayoutV2WideBlockToNarrowRow(
      withNarrowRow,
      wideRow.id,
      0,
      narrowRow.id,
    );

    expect(movedToNarrow.mainSplit.wideRows.at(-1)?.blocks[0]?.type).toBe(
      "map_nearby",
    );
    expect(movedToNarrow.mainSplit.narrowRows.at(-1)?.block?.type).toBe(
      "pool",
    );

    const movedBackToWide = moveDetailLayoutV2NarrowBlockToWideSlot(
      movedToNarrow,
      narrowRow.id,
      wideRow.id,
      0,
    );

    expect(movedBackToWide.mainSplit.wideRows.at(-1)?.blocks[0]?.type).toBe(
      "pool",
    );
    expect(movedBackToWide.mainSplit.narrowRows.at(-1)?.block?.type).toBe(
      "map_nearby",
    );
  });

  it("adds, fills, and reorders narrow rows as one-block vertical items", () => {
    const draft = toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2);
    const added = addDetailLayoutV2NarrowRow(draft);
    const emptyRow = added.mainSplit.narrowRows.at(-1);

    if (!emptyRow) {
      throw new Error("Expected a narrow draft row");
    }

    expect(emptyRow.block).toBeNull();
    expect(validateDetailLayoutV2DraftForSave(added)).toContain(
      "ฝั่ง 30 ลำดับที่ 4 ต้องมี block",
    );

    const filled = putDetailLayoutV2NarrowBlock(
      added,
      emptyRow.id,
      makeDetailLayoutBlock("map_nearby"),
    );
    const moved = moveDetailLayoutV2NarrowRow(
      filled,
      filled.mainSplit.narrowRows.length - 1,
      0,
    );

    expect(moved.mainSplit.narrowRows[0].block?.type).toBe("map_nearby");
    expect(validateDetailLayoutV2DraftForSave(filled)).not.toContain(
      "ฝั่ง 30 ลำดับที่ 4 ต้องมี block",
    );
  });

  it("updates the outer split ratio and moves wide rows independently", () => {
    const draft = updateDetailLayoutV2OuterRatio(
      toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2),
      "30/70",
    );
    const moved = moveDetailLayoutV2WideRow(
      draft,
      0,
      draft.mainSplit.wideRows.length - 1,
    );

    expect(moved.mainSplit.ratio).toBe("30/70");
    expect(moved.mainSplit.wideRows.at(-1)?.id).toBe(
      DEFAULT_DETAIL_LAYOUT_V2.mainSplit.wideRows[0].id,
    );
  });

  it("creates stable snapshots and valid V2 config from filled drafts", () => {
    const first = toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2);
    const second = toDetailLayoutV2Draft(DEFAULT_DETAIL_LAYOUT_V2);
    const config = toDetailLayoutV2Config(first);

    expect(makeDetailLayoutV2Snapshot(first)).toBe(
      makeDetailLayoutV2Snapshot(second),
    );
    expect(config).toEqual(DEFAULT_DETAIL_LAYOUT_V2);
    expect(config).not.toBe(DEFAULT_DETAIL_LAYOUT_V2);
    expect(validateDetailLayoutV2(config).ok).toBe(true);
  });
});
