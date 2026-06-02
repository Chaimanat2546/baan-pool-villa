import {
  DETAIL_LAYOUT_ALLOWED_RATIOS,
  DETAIL_LAYOUT_BLOCK_LABELS,
} from "../../../lib/detail-layout/defaults";
import type {
  DetailLayoutBlock,
  DetailLayoutBlockType,
  DetailLayoutColumns,
  DetailLayoutConfig,
  DetailLayoutRatio,
} from "../../../lib/detail-layout/types";
import { DETAIL_LAYOUT_BLOCK_TYPES } from "../../../lib/detail-layout/types";
import { cloneDetailLayout } from "../../../lib/detail-layout/validation";
import type { DetailLayoutDraft, DetailLayoutDraftRow } from "./types";

const DEFAULT_TWO_COLUMN_RATIO: DetailLayoutRatio = "50/50";
const DETAIL_LAYOUT_BLOCK_TYPE_SET = new Set<string>(DETAIL_LAYOUT_BLOCK_TYPES);

let rowIdFallbackCounter = 0;

function makeDraftRowId(): string {
  const cryptoProvider = globalThis.crypto;

  if (typeof cryptoProvider?.randomUUID === "function") {
    return `row_${cryptoProvider.randomUUID()}`;
  }

  if (typeof cryptoProvider?.getRandomValues === "function") {
    const values = new Uint32Array(2);
    cryptoProvider.getRandomValues(values);

    return `row_${Array.from(values, (value) =>
      value.toString(16).padStart(8, "0"),
    ).join("")}`;
  }

  rowIdFallbackCounter += 1;
  return `row_${Date.now()}_${rowIdFallbackCounter}`;
}

function withUpdatedRow(
  layout: DetailLayoutDraft,
  rowId: string,
  updater: (row: DetailLayoutDraftRow) => DetailLayoutDraftRow,
): DetailLayoutDraft {
  const clonedLayout = cloneDetailLayoutDraft(layout);

  return {
    ...clonedLayout,
    rows: clonedLayout.rows.map((row) =>
      row.id === rowId ? updater(row) : row,
    ),
  };
}

function cloneDetailLayoutDraft(draft: DetailLayoutDraft): DetailLayoutDraft {
  return {
    version: draft.version,
    lockedTop: [...draft.lockedTop],
    rows: draft.rows.map((row) => ({
      id: row.id,
      columns: row.columns,
      ...(row.ratio === undefined ? {} : { ratio: row.ratio }),
      enabled: row.enabled,
      blocks: row.blocks.map((block) => (block ? { ...block } : null)),
    })),
  };
}

function makeDraftSlots(
  blocks: DetailLayoutBlock[],
  columns: DetailLayoutColumns,
) {
  return Array.from(
    { length: columns },
    (_, index) => blocks[index] ? { ...blocks[index] } : null,
  );
}

function normalizeRatioForColumns(
  columns: DetailLayoutColumns,
  ratio?: DetailLayoutRatio,
): DetailLayoutRatio | undefined {
  if (columns !== 2) {
    return undefined;
  }

  return ratio && DETAIL_LAYOUT_ALLOWED_RATIOS.includes(ratio)
    ? ratio
    : DEFAULT_TWO_COLUMN_RATIO;
}

export function makeDetailLayoutSnapshot(
  layout: DetailLayoutDraft,
): string {
  return JSON.stringify(layout);
}

export function toDetailLayoutDraft(
  layout: DetailLayoutConfig,
): DetailLayoutDraft {
  const clonedLayout = cloneDetailLayout(layout);

  return {
    version: clonedLayout.version,
    lockedTop: [...clonedLayout.lockedTop],
    rows: clonedLayout.rows.map((row) => ({
      id: row.id,
      columns: row.columns,
      ...(row.ratio === undefined ? {} : { ratio: row.ratio }),
      enabled: row.enabled,
      blocks: makeDraftSlots(row.blocks, row.columns),
    })),
  };
}

export function toDetailLayoutConfig(
  draft: DetailLayoutDraft,
): DetailLayoutConfig {
  return {
    version: draft.version,
    lockedTop: [...draft.lockedTop],
    rows: draft.rows.map((row) => ({
      id: row.id,
      columns: row.columns,
      ...(row.ratio === undefined ? {} : { ratio: row.ratio }),
      enabled: row.enabled,
      blocks: row.blocks.filter(
        (block): block is DetailLayoutBlock => block !== null,
      ),
    })),
  };
}

export function validateDetailLayoutDraftForSave(
  draft: DetailLayoutDraft,
): string[] {
  return draft.rows.flatMap((row, rowIndex) => {
    const firstBlockAfterGapIndex = row.blocks.findIndex(
      (block, blockIndex) =>
        block !== null &&
        row.blocks.slice(0, blockIndex).some((slot) => slot === null),
    );

    return firstBlockAfterGapIndex >= 0
      ? [
          `แถวที่ ${rowIndex + 1} มีช่องว่างก่อน block กรุณาเติมหรือลบ block ด้านหลัง`,
        ]
      : [];
  });
}

export function makeDetailLayoutBlock(
  type: DetailLayoutBlockType,
): DetailLayoutBlock {
  return {
    type,
    title: DETAIL_LAYOUT_BLOCK_LABELS[type],
    enabled: true,
    hideWhenEmpty: true,
  };
}

export function isDetailLayoutBlockType(
  value: unknown,
): value is DetailLayoutBlockType {
  return typeof value === "string" && DETAIL_LAYOUT_BLOCK_TYPE_SET.has(value);
}

export function getDetailLayoutBlockTargetSlot(
  row: DetailLayoutDraftRow,
  activeBlockIndex: number | null,
): number | null {
  if (
    activeBlockIndex !== null &&
    Number.isInteger(activeBlockIndex) &&
    activeBlockIndex >= 0 &&
    activeBlockIndex < row.blocks.length &&
    row.blocks[activeBlockIndex] === null
  ) {
    return activeBlockIndex;
  }

  const firstEmptyIndex = row.blocks.findIndex((block) => block === null);

  return firstEmptyIndex >= 0 ? firstEmptyIndex : null;
}

export function addDetailLayoutRow(
  layout: DetailLayoutDraft,
  columns: DetailLayoutColumns,
): DetailLayoutDraft {
  const clonedLayout = cloneDetailLayoutDraft(layout);
  const ratio = normalizeRatioForColumns(columns);
  const nextRow: DetailLayoutDraftRow = {
    id: makeDraftRowId(),
    columns,
    ...(ratio === undefined ? {} : { ratio }),
    enabled: true,
    blocks: Array.from({ length: columns }, () => null),
  };

  return {
    ...clonedLayout,
    rows: [...clonedLayout.rows, nextRow],
  };
}

export function updateDetailLayoutRowColumns(
  layout: DetailLayoutDraft,
  rowId: string,
  columns: DetailLayoutColumns,
  ratio?: DetailLayoutRatio,
): DetailLayoutDraft {
  return withUpdatedRow(layout, rowId, (row) => {
    const nextRatio = normalizeRatioForColumns(columns, ratio ?? row.ratio);
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

export function updateDetailLayoutRow(
  layout: DetailLayoutDraft,
  rowId: string,
  changes: Partial<Pick<DetailLayoutDraftRow, "enabled" | "ratio">>,
): DetailLayoutDraft {
  return withUpdatedRow(layout, rowId, (row) => {
    const nextRatio =
      row.columns === 2
        ? normalizeRatioForColumns(row.columns, changes.ratio ?? row.ratio)
        : undefined;

    return {
      ...row,
      ...changes,
      ...(nextRatio === undefined ? { ratio: undefined } : { ratio: nextRatio }),
    };
  });
}

export function updateDetailLayoutBlock(
  layout: DetailLayoutDraft,
  rowId: string,
  blockIndex: number,
  changes: Partial<Omit<DetailLayoutBlock, "type">>,
): DetailLayoutDraft {
  return withUpdatedRow(layout, rowId, (row) => ({
    ...row,
    blocks: row.blocks.map((block, index) =>
      index === blockIndex && block ? { ...block, ...changes } : block,
    ),
  }));
}

export function putDetailLayoutBlockInSlot(
  layout: DetailLayoutDraft,
  rowId: string,
  blockIndex: number,
  block: DetailLayoutBlock,
): DetailLayoutDraft {
  return withUpdatedRow(layout, rowId, (row) => {
    if (blockIndex < 0 || blockIndex >= row.columns) {
      return row;
    }

    const blocks = [...row.blocks];
    blocks[blockIndex] = block;

    return {
      ...row,
      blocks,
    };
  });
}

export function removeDetailLayoutBlock(
  layout: DetailLayoutDraft,
  rowId: string,
  blockIndex: number,
): DetailLayoutDraft {
  return withUpdatedRow(layout, rowId, (row) => ({
    ...row,
    blocks: row.blocks.map((block, index) =>
      index === blockIndex ? null : block,
    ),
  }));
}

export function compactDetailLayoutRowBlocks(
  layout: DetailLayoutDraft,
  rowId: string,
): DetailLayoutDraft {
  return withUpdatedRow(layout, rowId, (row) => {
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

export function moveDetailLayoutBlockToSlot(
  layout: DetailLayoutDraft,
  fromRowId: string,
  fromBlockIndex: number,
  toRowId: string,
  toBlockIndex: number,
): DetailLayoutDraft {
  const clonedLayout = cloneDetailLayoutDraft(layout);
  const fromRow = clonedLayout.rows.find((row) => row.id === fromRowId);
  const toRow = clonedLayout.rows.find((row) => row.id === toRowId);

  if (!fromRow || !toRow) {
    return clonedLayout;
  }

  const fromIsValid =
    Number.isInteger(fromBlockIndex) &&
    fromBlockIndex >= 0 &&
    fromBlockIndex < fromRow.blocks.length;
  const toIsValid =
    Number.isInteger(toBlockIndex) &&
    toBlockIndex >= 0 &&
    toBlockIndex < toRow.blocks.length;

  if (!fromIsValid || !toIsValid) {
    return clonedLayout;
  }

  if (fromRow.id === toRow.id && fromBlockIndex === toBlockIndex) {
    return clonedLayout;
  }

  const fromBlock = fromRow.blocks[fromBlockIndex];

  if (!fromBlock) {
    return clonedLayout;
  }

  const toBlock = toRow.blocks[toBlockIndex];

  toRow.blocks[toBlockIndex] = fromBlock;
  fromRow.blocks[fromBlockIndex] = toBlock;

  return clonedLayout;
}

export function duplicateDetailLayoutRow(
  layout: DetailLayoutDraft,
  rowId: string,
): DetailLayoutDraft {
  const clonedLayout = cloneDetailLayoutDraft(layout);
  const rowIndex = clonedLayout.rows.findIndex((row) => row.id === rowId);

  if (rowIndex < 0) {
    return clonedLayout;
  }

  const row = clonedLayout.rows[rowIndex];
  const duplicateRow: DetailLayoutDraftRow = {
    ...row,
    id: makeDraftRowId(),
    blocks: row.blocks.map((block) => (block ? { ...block } : null)),
  };

  clonedLayout.rows.splice(rowIndex + 1, 0, duplicateRow);
  return clonedLayout;
}

export function moveDetailLayoutDraftRow(
  draft: DetailLayoutDraft,
  fromIndex: number,
  toIndex: number,
): DetailLayoutDraft {
  const clonedDraft = cloneDetailLayoutDraft(draft);
  const fromIsValid =
    Number.isInteger(fromIndex) &&
    fromIndex >= 0 &&
    fromIndex < clonedDraft.rows.length;
  const toIsValid =
    Number.isInteger(toIndex) &&
    toIndex >= 0 &&
    toIndex < clonedDraft.rows.length;

  if (!fromIsValid || !toIsValid || fromIndex === toIndex) {
    return clonedDraft;
  }

  const [selectedRow] = clonedDraft.rows.splice(fromIndex, 1);
  clonedDraft.rows.splice(toIndex, 0, selectedRow);

  return clonedDraft;
}

export function deleteDetailLayoutRow(
  layout: DetailLayoutDraft,
  rowId: string,
): DetailLayoutDraft {
  const clonedLayout = cloneDetailLayoutDraft(layout);

  return {
    ...clonedLayout,
    rows: clonedLayout.rows.filter((row) => row.id !== rowId),
  };
}

export function getFirstEditableRowId(
  layout: DetailLayoutDraft,
): string | null {
  return layout.rows[0]?.id ?? null;
}
