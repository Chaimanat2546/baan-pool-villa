import type {
  DetailLayoutBlockType,
  DetailLayoutRatio,
  DetailLayoutRow,
} from "@/lib/detail-layout/types";

export const ratioGridClassMap: Record<DetailLayoutRatio, string> = {
  "50/50": "lg:grid-cols-2",
  "60/40": "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
  "70/30": "lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]",
  "40/60": "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
  "30/70": "lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]",
};

export type DetailLayoutSplitRatio = "70/30" | "30/70";

export interface DetailLayoutBlockForLayout {
  type: DetailLayoutBlockType;
}

export function getRowGridClass(
  row: DetailLayoutRow,
  visibleBlockCount: number,
): string {
  if (visibleBlockCount <= 1) {
    return "lg:grid-cols-1";
  }

  if (visibleBlockCount >= 3) {
    return "lg:grid-cols-3";
  }

  if (row.columns === 2) {
    return row.ratio ? ratioGridClassMap[row.ratio] : "lg:grid-cols-2";
  }

  return "lg:grid-cols-2";
}

export function isSplitRatio(
  ratio: DetailLayoutRow["ratio"],
): ratio is DetailLayoutSplitRatio {
  return ratio === "70/30" || ratio === "30/70";
}

export function isLockedFullWidthBlock(
  block: DetailLayoutBlockForLayout,
): boolean {
  return block.type === "recommended_villas";
}

export function isLockedFullWidthRow(
  blocks: DetailLayoutBlockForLayout[],
): boolean {
  return blocks.some(isLockedFullWidthBlock);
}

export function isSplitRow(
  row: DetailLayoutRow,
  blocks: DetailLayoutBlockForLayout[],
): row is DetailLayoutRow & { ratio: DetailLayoutSplitRatio } {
  return row.columns === 2 && isSplitRatio(row.ratio) && blocks.length >= 2;
}

export function appendWideRows<TBlock>(wideRows: TBlock[][], blocks: TBlock[]) {
  for (let index = 0; index < blocks.length; index += 2) {
    wideRows.push(blocks.slice(index, index + 2));
  }
}

export function splitWideColumns<TBlock>(wideRows: TBlock[][]) {
  const leftColumn: TBlock[] = [];
  const rightColumn: TBlock[] = [];

  wideRows.forEach((row) => {
    const [leftBlock, rightBlock] = row;

    if (leftBlock) {
      leftColumn.push(leftBlock);
    }

    if (rightBlock) {
      rightColumn.push(rightBlock);
    }
  });

  return { leftColumn, rightColumn };
}

export function splitV2WideColumns<TBlock>(rows: { blocks: TBlock[] }[]) {
  const leftColumn: TBlock[] = [];
  const rightColumn: TBlock[] = [];

  rows.forEach((row) => {
    const [leftBlock, rightBlock] = row.blocks;

    if (leftBlock) {
      leftColumn.push(leftBlock);
    }

    if (rightBlock) {
      rightColumn.push(rightBlock);
    }
  });

  return { leftColumn, rightColumn };
}
