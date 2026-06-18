import type {
  DetailLayoutBlockType,
  DetailLayoutRow,
  DetailLayoutWideRatio,
  DetailLayoutWideRow,
} from "@/lib/detail-layout/types";
import type { ReactNode } from "react";
import {
  getRowGridClass,
  isLockedFullWidthRow,
  ratioGridClassMap,
  splitV2WideColumns,
  splitWideColumns,
  type DetailLayoutSplitRatio,
} from "./detail-layout-renderer-helpers";

export interface RenderedDetailLayoutBlock {
  key: string;
  node: ReactNode;
  type: DetailLayoutBlockType;
}

export interface RenderedDetailLayoutWideRow {
  blocks: RenderedDetailLayoutBlock[];
  columns: DetailLayoutWideRow["columns"];
  id: string;
  ratio?: DetailLayoutWideRatio;
}

interface RenderSplitSectionProps {
  id: string;
  narrowBlocks: RenderedDetailLayoutBlock[];
  ratio: DetailLayoutSplitRatio;
  wideRows: RenderedDetailLayoutBlock[][];
}

export function renderBlockContainer(block: RenderedDetailLayoutBlock) {
  const visibilityClass =
    block.type === "booking_contact" ? "hidden lg:block" : "";

  return (
    <div
      key={block.key}
      className={`min-w-0 self-start ${visibilityClass}`.trim()}
      data-detail-layout-block={block.type}
    >
      {block.node}
    </div>
  );
}

export function renderStandardRow(
  row: DetailLayoutRow,
  blocks: RenderedDetailLayoutBlock[],
) {
  const rowGridClass = isLockedFullWidthRow(blocks)
    ? "lg:grid-cols-1"
    : getRowGridClass(row, blocks.length);

  return (
    <div
      key={row.id}
      className={`grid min-w-0 items-start gap-6 ${rowGridClass}`}
      data-detail-layout-row={row.id}
    >
      {blocks.map(renderBlockContainer)}
    </div>
  );
}

export function renderWideArea(wideRows: RenderedDetailLayoutBlock[][]) {
  const { leftColumn, rightColumn } = splitWideColumns(wideRows);

  return (
    <div
      className="grid min-w-0 gap-6 lg:grid-cols-2"
      data-detail-layout-area="wide"
    >
      <div className="grid min-w-0 content-start gap-6" data-detail-layout-wide-column="left">
        {leftColumn.map(renderBlockContainer)}
      </div>
      <div className="grid min-w-0 content-start gap-6" data-detail-layout-wide-column="right">
        {rightColumn.map(renderBlockContainer)}
      </div>
    </div>
  );
}

export function renderNarrowArea(blocks: RenderedDetailLayoutBlock[]) {
  return (
    <aside
      className="grid min-w-0 self-start gap-6"
      data-detail-layout-area="narrow"
    >
      {blocks.map(renderBlockContainer)}
    </aside>
  );
}

export function renderSplitSection({
  id,
  narrowBlocks,
  ratio,
  wideRows,
}: RenderSplitSectionProps) {
  const wideArea = renderWideArea(wideRows);
  const narrowArea = renderNarrowArea(narrowBlocks);

  return (
    <div
      key={`split-${id}`}
      className={`grid min-w-0 items-start gap-6 ${ratioGridClassMap[ratio]}`}
      data-detail-layout-split={id}
    >
      {ratio === "70/30" ? (
        <>
          {wideArea}
          {narrowArea}
        </>
      ) : (
        <>
          {narrowArea}
          {wideArea}
        </>
      )}
    </div>
  );
}

export function renderV2WideFullRow(row: RenderedDetailLayoutWideRow) {
  return (
    <div
      key={row.id}
      className="grid min-w-0 items-start gap-6"
      data-detail-layout-area="wide"
      data-detail-layout-wide-row={row.id}
    >
      {row.blocks.map(renderBlockContainer)}
    </div>
  );
}

export function renderV2WideStackGroup(
  rows: RenderedDetailLayoutWideRow[],
  ratio: DetailLayoutWideRatio,
) {
  const { leftColumn, rightColumn } = splitV2WideColumns(rows);
  const rowIds = rows.map((row) => row.id).join(" ");

  return (
    <div
      key={rowIds}
      className={`grid min-w-0 gap-6 ${ratioGridClassMap[ratio]}`}
      data-detail-layout-area="wide"
      data-detail-layout-wide-ratio={ratio}
      data-detail-layout-wide-rows={rowIds}
    >
      <div className="grid min-w-0 content-start gap-6" data-detail-layout-wide-column="left">
        {leftColumn.map(renderBlockContainer)}
      </div>
      <div className="grid min-w-0 content-start gap-6" data-detail-layout-wide-column="right">
        {rightColumn.map(renderBlockContainer)}
      </div>
    </div>
  );
}

export function renderV2WideArea(rows: RenderedDetailLayoutWideRow[]) {
  const renderedRows: ReactNode[] = [];
  let stackRows: RenderedDetailLayoutWideRow[] = [];
  let stackRatio: DetailLayoutWideRatio | null = null;

  const flushStackRows = () => {
    if (stackRows.length === 0 || stackRatio === null) {
      return;
    }

    renderedRows.push(renderV2WideStackGroup(stackRows, stackRatio));
    stackRows = [];
    stackRatio = null;
  };

  rows.forEach((row) => {
    if (row.columns === 1 || row.blocks.length <= 1) {
      flushStackRows();
      renderedRows.push(renderV2WideFullRow(row));
      return;
    }

    const rowRatio = row.ratio ?? "50/50";

    if (stackRatio !== null && stackRatio !== rowRatio) {
      flushStackRows();
    }

    stackRatio = rowRatio;
    stackRows.push(row);
  });

  flushStackRows();

  if (renderedRows.length === 0) {
    return null;
  }

  return (
    <div
      className="grid min-w-0 content-start gap-6"
      data-detail-layout-area="wide"
      data-detail-layout-wide="mainSplit"
    >
      {renderedRows}
    </div>
  );
}

export function renderV2NarrowArea(blocks: RenderedDetailLayoutBlock[]) {
  if (blocks.length === 0) {
    return null;
  }

  return renderNarrowArea(blocks);
}

export function renderV2LockedBottom(blocks: RenderedDetailLayoutBlock[]) {
  if (blocks.length === 0) {
    return null;
  }

  return (
    <div
      key="lockedBottom"
      className="grid min-w-0 gap-6"
      data-detail-layout-area="lockedBottom"
    >
      {blocks.map(renderBlockContainer)}
    </div>
  );
}
