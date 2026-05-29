import {
  DETAIL_LAYOUT_WIDE_ROW_RATIOS,
} from "../../../lib/detail-layout/defaults";
import type {
  AnyDetailLayoutConfig,
  DetailLayoutBlock,
  DetailLayoutOuterRatio,
  DetailLayoutV2Config,
  DetailLayoutWideColumns,
  DetailLayoutWideRatio,
} from "../../../lib/detail-layout/types";
import {
  cloneDetailLayoutV2,
  normalizeDetailLayoutV2,
} from "../../../lib/detail-layout/version-2";
import type {
  DetailLayoutDraftSlot,
  DetailLayoutV2Draft,
  DetailLayoutV2DraftNarrowRow,
  DetailLayoutV2DraftWideRow,
} from "./types";

const DEFAULT_WIDE_ROW_RATIO: DetailLayoutWideRatio = "50/50";

let v2RowIdFallbackCounter = 0;

function makeV2DraftRowId(prefix: "narrow" | "wide"): string {
  const cryptoProvider = globalThis.crypto;

  if (typeof cryptoProvider?.randomUUID === "function") {
    return `${prefix}_${cryptoProvider.randomUUID()}`;
  }

  if (typeof cryptoProvider?.getRandomValues === "function") {
    const values = new Uint32Array(2);
    cryptoProvider.getRandomValues(values);

    return `${prefix}_${Array.from(values, (value) =>
      value.toString(16).padStart(8, "0"),
    ).join("")}`;
  }

  v2RowIdFallbackCounter += 1;
  return `${prefix}_${Date.now()}_${v2RowIdFallbackCounter}`;
}

function cloneBlock(block: DetailLayoutBlock): DetailLayoutBlock {
  return { ...block };
}

function cloneSlot(block: DetailLayoutDraftSlot): DetailLayoutDraftSlot {
  return block ? cloneBlock(block) : null;
}

function cloneDetailLayoutV2Draft(
  draft: DetailLayoutV2Draft,
): DetailLayoutV2Draft {
  return {
    version: 2,
    lockedTop: [...draft.lockedTop],
    mainSplit: {
      ratio: draft.mainSplit.ratio,
      wideRows: draft.mainSplit.wideRows.map((row) => ({
        id: row.id,
        columns: row.columns,
        ...(row.ratio === undefined ? {} : { ratio: row.ratio }),
        enabled: row.enabled,
        blocks: row.blocks.map(cloneSlot),
      })),
      narrowRows: draft.mainSplit.narrowRows.map((row) => ({
        id: row.id,
        enabled: row.enabled,
        block: cloneSlot(row.block),
      })),
    },
    lockedBottom: draft.lockedBottom.map(cloneBlock),
  };
}

function makeDraftSlots(
  blocks: DetailLayoutBlock[],
  columns: DetailLayoutWideColumns,
): DetailLayoutDraftSlot[] {
  return Array.from(
    { length: columns },
    (_, index) => (blocks[index] ? cloneBlock(blocks[index]) : null),
  );
}

function normalizeWideRatioForColumns(
  columns: DetailLayoutWideColumns,
  ratio?: DetailLayoutWideRatio,
): DetailLayoutWideRatio | undefined {
  if (columns !== 2) {
    return undefined;
  }

  return ratio && DETAIL_LAYOUT_WIDE_ROW_RATIOS.includes(ratio)
    ? ratio
    : DEFAULT_WIDE_ROW_RATIO;
}

function withUpdatedWideRow(
  draft: DetailLayoutV2Draft,
  rowId: string,
  updater: (
    row: DetailLayoutV2DraftWideRow,
  ) => DetailLayoutV2DraftWideRow,
): DetailLayoutV2Draft {
  const clonedDraft = cloneDetailLayoutV2Draft(draft);

  return {
    ...clonedDraft,
    mainSplit: {
      ...clonedDraft.mainSplit,
      wideRows: clonedDraft.mainSplit.wideRows.map((row) =>
        row.id === rowId ? updater(row) : row,
      ),
    },
  };
}

function withUpdatedNarrowRow(
  draft: DetailLayoutV2Draft,
  rowId: string,
  updater: (
    row: DetailLayoutV2DraftNarrowRow,
  ) => DetailLayoutV2DraftNarrowRow,
): DetailLayoutV2Draft {
  const clonedDraft = cloneDetailLayoutV2Draft(draft);

  return {
    ...clonedDraft,
    mainSplit: {
      ...clonedDraft.mainSplit,
      narrowRows: clonedDraft.mainSplit.narrowRows.map((row) =>
        row.id === rowId ? updater(row) : row,
      ),
    },
  };
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }

  const movedItems = [...items];
  const [selectedItem] = movedItems.splice(fromIndex, 1);
  movedItems.splice(toIndex, 0, selectedItem);

  return movedItems;
}

export function makeDetailLayoutV2Snapshot(
  draft: DetailLayoutV2Draft,
): string {
  return JSON.stringify(draft);
}

export function toDetailLayoutV2Draft(
  layout: AnyDetailLayoutConfig,
): DetailLayoutV2Draft {
  const normalizedLayout = normalizeDetailLayoutV2(layout);

  return {
    version: 2,
    lockedTop: [...normalizedLayout.lockedTop],
    mainSplit: {
      ratio: normalizedLayout.mainSplit.ratio,
      wideRows: normalizedLayout.mainSplit.wideRows.map((row) => ({
        id: row.id,
        columns: row.columns,
        ...(row.ratio === undefined ? {} : { ratio: row.ratio }),
        enabled: row.enabled,
        blocks: makeDraftSlots(row.blocks, row.columns),
      })),
      narrowRows: normalizedLayout.mainSplit.narrowRows.map((row) => ({
        id: row.id,
        enabled: row.enabled,
        block: cloneBlock(row.block),
      })),
    },
    lockedBottom: normalizedLayout.lockedBottom.map(cloneBlock),
  };
}

export function toDetailLayoutV2Config(
  draft: DetailLayoutV2Draft,
): DetailLayoutV2Config {
  return cloneDetailLayoutV2({
    version: 2,
    lockedTop: [...draft.lockedTop],
    mainSplit: {
      ratio: draft.mainSplit.ratio,
      wideRows: draft.mainSplit.wideRows.map((row) => ({
        id: row.id,
        columns: row.columns,
        ...(row.ratio === undefined ? {} : { ratio: row.ratio }),
        enabled: row.enabled,
        blocks: row.blocks.filter(
          (block): block is DetailLayoutBlock => block !== null,
        ),
      })),
      narrowRows: draft.mainSplit.narrowRows.flatMap((row) =>
        row.block
          ? [
              {
                id: row.id,
                enabled: row.enabled,
                block: row.block,
              },
            ]
          : [],
      ),
    },
    lockedBottom: draft.lockedBottom.map(cloneBlock),
  });
}

export function validateDetailLayoutV2DraftForSave(
  draft: DetailLayoutV2Draft,
): string[] {
  const errors: string[] = [];

  draft.mainSplit.wideRows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const filledBlocks = row.blocks.filter(
      (block): block is DetailLayoutBlock => block !== null,
    );
    const firstBlockAfterGapIndex = row.blocks.findIndex(
      (block, blockIndex) =>
        block !== null &&
        row.blocks.slice(0, blockIndex).some((slot) => slot === null),
    );

    if (filledBlocks.length === 0) {
      errors.push(`ฝั่ง 70 แถวที่ ${rowNumber} ต้องมี block อย่างน้อย 1 รายการ`);
    }

    if (firstBlockAfterGapIndex >= 0) {
      errors.push(
        `ฝั่ง 70 แถวที่ ${rowNumber} มีช่องว่างก่อน block กรุณาเติมหรือลบ block ด้านหลัง`,
      );
    }
  });

  draft.mainSplit.narrowRows.forEach((row, rowIndex) => {
    if (row.block === null) {
      errors.push(`ฝั่ง 30 ลำดับที่ ${rowIndex + 1} ต้องมี block`);
    }
  });

  if (
    !draft.lockedBottom.some((block) => block.type === "recommended_villas")
  ) {
    errors.push("บ้านพักแนะนำต้องถูกล็อกไว้ด้านล่าง");
  }

  return errors;
}

export function updateDetailLayoutV2OuterRatio(
  draft: DetailLayoutV2Draft,
  ratio: DetailLayoutOuterRatio,
): DetailLayoutV2Draft {
  const clonedDraft = cloneDetailLayoutV2Draft(draft);

  return {
    ...clonedDraft,
    mainSplit: {
      ...clonedDraft.mainSplit,
      ratio,
    },
  };
}

export function addDetailLayoutV2WideRow(
  draft: DetailLayoutV2Draft,
  columns: DetailLayoutWideColumns,
  ratio?: DetailLayoutWideRatio,
): DetailLayoutV2Draft {
  const clonedDraft = cloneDetailLayoutV2Draft(draft);
  const nextRatio = normalizeWideRatioForColumns(columns, ratio);

  return {
    ...clonedDraft,
    mainSplit: {
      ...clonedDraft.mainSplit,
      wideRows: [
        ...clonedDraft.mainSplit.wideRows,
        {
          id: makeV2DraftRowId("wide"),
          columns,
          ...(nextRatio === undefined ? {} : { ratio: nextRatio }),
          enabled: true,
          blocks: Array.from({ length: columns }, () => null),
        },
      ],
    },
  };
}

export function updateDetailLayoutV2WideRowColumns(
  draft: DetailLayoutV2Draft,
  rowId: string,
  columns: DetailLayoutWideColumns,
  ratio?: DetailLayoutWideRatio,
): DetailLayoutV2Draft {
  return withUpdatedWideRow(draft, rowId, (row) => {
    const nextRatio = normalizeWideRatioForColumns(columns, ratio ?? row.ratio);
    const nextBlocks = row.blocks.slice(0, columns);

    return {
      ...row,
      columns,
      ...(nextRatio === undefined ? { ratio: undefined } : { ratio: nextRatio }),
      blocks: [
        ...nextBlocks,
        ...Array.from({ length: columns - nextBlocks.length }, () => null),
      ],
    };
  });
}

export function putDetailLayoutV2WideBlockInSlot(
  draft: DetailLayoutV2Draft,
  rowId: string,
  blockIndex: number,
  block: DetailLayoutBlock,
): DetailLayoutV2Draft {
  return withUpdatedWideRow(draft, rowId, (row) => {
    if (blockIndex < 0 || blockIndex >= row.columns) {
      return row;
    }

    const blocks = [...row.blocks];
    blocks[blockIndex] = cloneBlock(block);

    return {
      ...row,
      blocks,
    };
  });
}

export function removeDetailLayoutV2WideBlock(
  draft: DetailLayoutV2Draft,
  rowId: string,
  blockIndex: number,
): DetailLayoutV2Draft {
  return withUpdatedWideRow(draft, rowId, (row) => ({
    ...row,
    blocks: row.blocks.map((block, index) =>
      index === blockIndex ? null : block,
    ),
  }));
}

export function compactDetailLayoutV2WideRowBlocks(
  draft: DetailLayoutV2Draft,
  rowId: string,
): DetailLayoutV2Draft {
  return withUpdatedWideRow(draft, rowId, (row) => {
    const blocks = row.blocks.filter(
      (block): block is DetailLayoutBlock => block !== null,
    );

    return {
      ...row,
      blocks: [
        ...blocks,
        ...Array.from({ length: row.columns - blocks.length }, () => null),
      ],
    };
  });
}

export function updateDetailLayoutV2WideRow(
  draft: DetailLayoutV2Draft,
  rowId: string,
  changes: Partial<Pick<DetailLayoutV2DraftWideRow, "enabled" | "ratio">>,
): DetailLayoutV2Draft {
  return withUpdatedWideRow(draft, rowId, (row) => ({
    ...row,
    ...changes,
  }));
}

export function updateDetailLayoutV2WideBlock(
  draft: DetailLayoutV2Draft,
  rowId: string,
  blockIndex: number,
  changes: Partial<Omit<DetailLayoutBlock, "type">>,
): DetailLayoutV2Draft {
  return withUpdatedWideRow(draft, rowId, (row) => {
    if (blockIndex < 0 || blockIndex >= row.blocks.length) {
      return row;
    }

    const block = row.blocks[blockIndex];

    if (!block) {
      return row;
    }

    const blocks = [...row.blocks];
    blocks[blockIndex] = { ...block, ...changes };

    return {
      ...row,
      blocks,
    };
  });
}

export function deleteDetailLayoutV2WideRow(
  draft: DetailLayoutV2Draft,
  rowId: string,
): DetailLayoutV2Draft {
  const clonedDraft = cloneDetailLayoutV2Draft(draft);
  const wideRows = clonedDraft.mainSplit.wideRows.filter(
    (row) => row.id !== rowId,
  );

  return {
    ...clonedDraft,
    mainSplit: {
      ...clonedDraft.mainSplit,
      wideRows:
        wideRows.length > 0
          ? wideRows
          : [
              {
                id: makeV2DraftRowId("wide"),
                columns: 1,
                enabled: true,
                blocks: [null],
              },
            ],
    },
  };
}

export function duplicateDetailLayoutV2WideRow(
  draft: DetailLayoutV2Draft,
  rowId: string,
): DetailLayoutV2Draft {
  const clonedDraft = cloneDetailLayoutV2Draft(draft);
  const rowIndex = clonedDraft.mainSplit.wideRows.findIndex(
    (row) => row.id === rowId,
  );

  if (rowIndex < 0) {
    return clonedDraft;
  }

  const sourceRow = clonedDraft.mainSplit.wideRows[rowIndex];
  const duplicateRow = {
    ...sourceRow,
    id: makeV2DraftRowId("wide"),
    blocks: sourceRow.blocks.map(cloneSlot),
  };
  const wideRows = [...clonedDraft.mainSplit.wideRows];
  wideRows.splice(rowIndex + 1, 0, duplicateRow);

  return {
    ...clonedDraft,
    mainSplit: {
      ...clonedDraft.mainSplit,
      wideRows,
    },
  };
}

export function moveDetailLayoutV2WideRow(
  draft: DetailLayoutV2Draft,
  fromIndex: number,
  toIndex: number,
): DetailLayoutV2Draft {
  const clonedDraft = cloneDetailLayoutV2Draft(draft);

  return {
    ...clonedDraft,
    mainSplit: {
      ...clonedDraft.mainSplit,
      wideRows: moveItem(clonedDraft.mainSplit.wideRows, fromIndex, toIndex),
    },
  };
}

export function addDetailLayoutV2NarrowRow(
  draft: DetailLayoutV2Draft,
  block: DetailLayoutBlock | null = null,
): DetailLayoutV2Draft {
  const clonedDraft = cloneDetailLayoutV2Draft(draft);

  return {
    ...clonedDraft,
    mainSplit: {
      ...clonedDraft.mainSplit,
      narrowRows: [
        ...clonedDraft.mainSplit.narrowRows,
        {
          id: makeV2DraftRowId("narrow"),
          enabled: true,
          block: cloneSlot(block),
        },
      ],
    },
  };
}

export function putDetailLayoutV2NarrowBlock(
  draft: DetailLayoutV2Draft,
  rowId: string,
  block: DetailLayoutBlock,
): DetailLayoutV2Draft {
  return withUpdatedNarrowRow(draft, rowId, (row) => ({
    ...row,
    block: cloneBlock(block),
  }));
}

export function updateDetailLayoutV2NarrowRow(
  draft: DetailLayoutV2Draft,
  rowId: string,
  changes: Partial<Pick<DetailLayoutV2DraftNarrowRow, "enabled">>,
): DetailLayoutV2Draft {
  return withUpdatedNarrowRow(draft, rowId, (row) => ({
    ...row,
    ...changes,
  }));
}

export function updateDetailLayoutV2NarrowBlock(
  draft: DetailLayoutV2Draft,
  rowId: string,
  changes: Partial<Omit<DetailLayoutBlock, "type">>,
): DetailLayoutV2Draft {
  return withUpdatedNarrowRow(draft, rowId, (row) => {
    if (!row.block) {
      return row;
    }

    return {
      ...row,
      block: { ...row.block, ...changes },
    };
  });
}

export function removeDetailLayoutV2NarrowBlock(
  draft: DetailLayoutV2Draft,
  rowId: string,
): DetailLayoutV2Draft {
  return withUpdatedNarrowRow(draft, rowId, (row) => ({
    ...row,
    block: null,
  }));
}

export function deleteDetailLayoutV2NarrowRow(
  draft: DetailLayoutV2Draft,
  rowId: string,
): DetailLayoutV2Draft {
  const clonedDraft = cloneDetailLayoutV2Draft(draft);
  const narrowRows = clonedDraft.mainSplit.narrowRows.filter(
    (row) => row.id !== rowId,
  );

  return {
    ...clonedDraft,
    mainSplit: {
      ...clonedDraft.mainSplit,
      narrowRows,
    },
  };
}

export function duplicateDetailLayoutV2NarrowRow(
  draft: DetailLayoutV2Draft,
  rowId: string,
): DetailLayoutV2Draft {
  const clonedDraft = cloneDetailLayoutV2Draft(draft);
  const rowIndex = clonedDraft.mainSplit.narrowRows.findIndex(
    (row) => row.id === rowId,
  );

  if (rowIndex < 0) {
    return clonedDraft;
  }

  const sourceRow = clonedDraft.mainSplit.narrowRows[rowIndex];
  const duplicateRow = {
    ...sourceRow,
    id: makeV2DraftRowId("narrow"),
    block: cloneSlot(sourceRow.block),
  };
  const narrowRows = [...clonedDraft.mainSplit.narrowRows];
  narrowRows.splice(rowIndex + 1, 0, duplicateRow);

  return {
    ...clonedDraft,
    mainSplit: {
      ...clonedDraft.mainSplit,
      narrowRows,
    },
  };
}

export function moveDetailLayoutV2NarrowRow(
  draft: DetailLayoutV2Draft,
  fromIndex: number,
  toIndex: number,
): DetailLayoutV2Draft {
  const clonedDraft = cloneDetailLayoutV2Draft(draft);

  return {
    ...clonedDraft,
    mainSplit: {
      ...clonedDraft.mainSplit,
      narrowRows: moveItem(clonedDraft.mainSplit.narrowRows, fromIndex, toIndex),
    },
  };
}
