import type {
  DetailLayoutBlockType,
  DetailLayoutWideRatio,
  DetailLayoutWideRow,
} from "@/lib/detail-layout/types";
import type { ReactNode } from "react";
import { groupDetailLayoutWideRows } from "@/lib/detail-layout/flow";
import {
  ratioGridClassMap,
} from "./detail-layout-renderer-helpers";

export interface RenderedDetailLayoutBlock {
  key: string;
  slotIndex: number;
  node: ReactNode;
  type: DetailLayoutBlockType;
}

export interface RenderedDetailLayoutWideRow {
  blocks: RenderedDetailLayoutBlock[];
  columns: DetailLayoutWideRow["columns"];
  id: string;
  ratio?: DetailLayoutWideRatio;
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
  const group = groupDetailLayoutWideRows(rows)[0];
  if (!group || group.kind !== "columns") return null;
  const { leftColumn, rightColumn } = group;
  const rowIds = rows.map((row) => row.id).join(" ");

  return (
    <div
      key={rowIds}
      className={`grid min-w-0 gap-6 ${leftColumn.length && rightColumn.length ? ratioGridClassMap[ratio] : "lg:grid-cols-1"}`}
      data-detail-layout-area="wide"
      data-detail-layout-wide-ratio={ratio}
      data-detail-layout-wide-rows={rowIds}
    >
      {leftColumn.length > 0 ? <div className="grid min-w-0 content-start gap-6" data-detail-layout-wide-column="left">
        {leftColumn.map(renderBlockContainer)}
      </div> : null}
      {rightColumn.length > 0 ? <div className="grid min-w-0 content-start gap-6" data-detail-layout-wide-column="right">
        {rightColumn.map(renderBlockContainer)}
      </div> : null}
    </div>
  );
}

export function renderV2WideArea(rows: RenderedDetailLayoutWideRow[]) {
  const renderedRows = groupDetailLayoutWideRows(rows).map((group) =>
    group.kind === "full"
      ? renderV2WideFullRow(group.row)
      : renderV2WideStackGroup(group.rows, "50/50"),
  );

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
