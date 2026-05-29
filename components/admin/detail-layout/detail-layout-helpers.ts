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
  DetailLayoutRow,
} from "../../../lib/detail-layout/types";
import { cloneDetailLayout } from "../../../lib/detail-layout/validation";

const DEFAULT_TWO_COLUMN_RATIO: DetailLayoutRatio = "50/50";

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
  layout: DetailLayoutConfig,
  rowId: string,
  updater: (row: DetailLayoutRow) => DetailLayoutRow,
): DetailLayoutConfig {
  const clonedLayout = cloneDetailLayout(layout);

  return {
    ...clonedLayout,
    rows: clonedLayout.rows.map((row) =>
      row.id === rowId ? updater(row) : row,
    ),
  };
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
  layout: DetailLayoutConfig,
): string {
  return JSON.stringify(layout);
}

export function makeDetailLayoutBlock(
  type: DetailLayoutBlockType,
): DetailLayoutBlock {
  return {
    type,
    title: DETAIL_LAYOUT_BLOCK_LABELS[type],
    enabled: true,
    hideWhenEmpty: type !== "booking_contact",
  };
}

export function addDetailLayoutRow(
  layout: DetailLayoutConfig,
  columns: DetailLayoutColumns,
): DetailLayoutConfig {
  const clonedLayout = cloneDetailLayout(layout);
  const ratio = normalizeRatioForColumns(columns);
  const nextRow: DetailLayoutRow = {
    id: makeDraftRowId(),
    columns,
    ...(ratio === undefined ? {} : { ratio }),
    enabled: true,
    blocks: [],
  };

  return {
    ...clonedLayout,
    rows: [...clonedLayout.rows, nextRow],
  };
}

export function updateDetailLayoutRowColumns(
  layout: DetailLayoutConfig,
  rowId: string,
  columns: DetailLayoutColumns,
  ratio?: DetailLayoutRatio,
): DetailLayoutConfig {
  return withUpdatedRow(layout, rowId, (row) => {
    const nextRatio = normalizeRatioForColumns(columns, ratio ?? row.ratio);

    return {
      ...row,
      columns,
      ...(nextRatio === undefined ? { ratio: undefined } : { ratio: nextRatio }),
      blocks: row.blocks.slice(0, columns),
    };
  });
}

export function updateDetailLayoutRow(
  layout: DetailLayoutConfig,
  rowId: string,
  changes: Partial<Pick<DetailLayoutRow, "enabled" | "ratio">>,
): DetailLayoutConfig {
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
  layout: DetailLayoutConfig,
  rowId: string,
  blockIndex: number,
  changes: Partial<Omit<DetailLayoutBlock, "type">>,
): DetailLayoutConfig {
  return withUpdatedRow(layout, rowId, (row) => ({
    ...row,
    blocks: row.blocks.map((block, index) =>
      index === blockIndex ? { ...block, ...changes } : block,
    ),
  }));
}

export function putDetailLayoutBlockInSlot(
  layout: DetailLayoutConfig,
  rowId: string,
  blockIndex: number,
  block: DetailLayoutBlock,
): DetailLayoutConfig {
  return withUpdatedRow(layout, rowId, (row) => {
    if (blockIndex < 0 || blockIndex >= row.columns) {
      return row;
    }

    if (blockIndex > row.blocks.length) {
      return row;
    }

    const blocks = [...row.blocks];
    blocks.splice(blockIndex, blockIndex < blocks.length ? 1 : 0, block);

    return {
      ...row,
      blocks: blocks.slice(0, row.columns),
    };
  });
}

export function removeDetailLayoutBlock(
  layout: DetailLayoutConfig,
  rowId: string,
  blockIndex: number,
): DetailLayoutConfig {
  return withUpdatedRow(layout, rowId, (row) => ({
    ...row,
    blocks: row.blocks.filter((_, index) => index !== blockIndex),
  }));
}

export function duplicateDetailLayoutRow(
  layout: DetailLayoutConfig,
  rowId: string,
): DetailLayoutConfig {
  const clonedLayout = cloneDetailLayout(layout);
  const rowIndex = clonedLayout.rows.findIndex((row) => row.id === rowId);

  if (rowIndex < 0) {
    return clonedLayout;
  }

  const row = clonedLayout.rows[rowIndex];
  const duplicateRow: DetailLayoutRow = {
    ...row,
    id: makeDraftRowId(),
    blocks: row.blocks.map((block) => ({ ...block })),
  };

  clonedLayout.rows.splice(rowIndex + 1, 0, duplicateRow);
  return clonedLayout;
}

export function deleteDetailLayoutRow(
  layout: DetailLayoutConfig,
  rowId: string,
): DetailLayoutConfig {
  const clonedLayout = cloneDetailLayout(layout);

  return {
    ...clonedLayout,
    rows: clonedLayout.rows.filter((row) => row.id !== rowId),
  };
}

export function getFirstEditableRowId(
  layout: DetailLayoutConfig,
): string | null {
  return layout.rows[0]?.id ?? null;
}
