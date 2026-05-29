import type {
  DetailLayoutBlockType,
  DetailLayoutConfig,
  DetailLayoutRatio,
  DetailLayoutRow,
} from "@/lib/detail-layout/types";
import type { SiteSettings } from "@/lib/site-settings/types";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { VillaListing } from "@/lib/villas/types";
import type { ReactNode } from "react";
import { renderDetailLayoutBlock } from "./detail-layout-blocks";
import type { GalleryCategory } from "./types";

export interface DetailLayoutRendererProps {
  content: VillaDetailContent;
  galleryCategories: GalleryCategory[];
  layout: DetailLayoutConfig;
  listing: VillaListing;
  recommendedVillas: VillaListing[];
  settings: SiteSettings;
}

const ratioGridClassMap: Record<DetailLayoutRatio, string> = {
  "50/50": "lg:grid-cols-2",
  "60/40": "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
  "70/30": "lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]",
  "40/60": "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
  "30/70": "lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]",
};

type DetailLayoutSplitRatio = "70/30" | "30/70";

interface DetailLayoutRenderContext {
  content: VillaDetailContent;
  galleryCategories: GalleryCategory[];
  listing: VillaListing;
  recommendedVillas: VillaListing[];
  settings: SiteSettings;
}

interface RenderedDetailLayoutBlock {
  key: string;
  node: ReactNode;
  type: DetailLayoutBlockType;
}

function getRowGridClass(row: DetailLayoutRow, visibleBlockCount: number): string {
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

function isSplitRatio(ratio: DetailLayoutRow["ratio"]): ratio is DetailLayoutSplitRatio {
  return ratio === "70/30" || ratio === "30/70";
}

function isLockedFullWidthBlock(block: RenderedDetailLayoutBlock): boolean {
  return block.type === "recommended_villas";
}

function isLockedFullWidthRow(blocks: RenderedDetailLayoutBlock[]): boolean {
  return blocks.some(isLockedFullWidthBlock);
}

function isSplitRow(
  row: DetailLayoutRow,
  blocks: RenderedDetailLayoutBlock[],
): row is DetailLayoutRow & { ratio: DetailLayoutSplitRatio } {
  return row.columns === 2 && isSplitRatio(row.ratio) && blocks.length >= 2;
}

function renderRowBlocks(
  row: DetailLayoutRow,
  context: DetailLayoutRenderContext,
): RenderedDetailLayoutBlock[] {
  const renderedBlocks: RenderedDetailLayoutBlock[] = [];

  row.blocks.forEach((block, blockIndex) => {
    if (!block.enabled) {
      return;
    }

    const node = renderDetailLayoutBlock(block, context);

    if (node === null) {
      return;
    }

    renderedBlocks.push({
      key: `${row.id}-${block.type}-${blockIndex}`,
      node,
      type: block.type,
    });
  });

  return renderedBlocks;
}

function renderBlockContainer(block: RenderedDetailLayoutBlock) {
  return (
    <div
      key={block.key}
      className="min-w-0 self-start"
      data-detail-layout-block={block.type}
    >
      {block.node}
    </div>
  );
}

function renderStandardRow(
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

function appendWideRows(
  wideRows: RenderedDetailLayoutBlock[][],
  blocks: RenderedDetailLayoutBlock[],
) {
  for (let index = 0; index < blocks.length; index += 2) {
    wideRows.push(blocks.slice(index, index + 2));
  }
}

function splitWideColumns(wideRows: RenderedDetailLayoutBlock[][]) {
  const leftColumn: RenderedDetailLayoutBlock[] = [];
  const rightColumn: RenderedDetailLayoutBlock[] = [];

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

function renderWideArea(wideRows: RenderedDetailLayoutBlock[][]) {
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

function renderNarrowArea(blocks: RenderedDetailLayoutBlock[]) {
  return (
    <aside
      className="grid min-w-0 self-start gap-6"
      data-detail-layout-area="narrow"
    >
      {blocks.map(renderBlockContainer)}
    </aside>
  );
}

function renderSplitSection({
  id,
  narrowBlocks,
  ratio,
  wideRows,
}: {
  id: string;
  narrowBlocks: RenderedDetailLayoutBlock[];
  ratio: DetailLayoutSplitRatio;
  wideRows: RenderedDetailLayoutBlock[][];
}) {
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

export function DetailLayoutRenderer({
  content,
  galleryCategories,
  layout,
  listing,
  recommendedVillas,
  settings,
}: DetailLayoutRendererProps) {
  const context = {
    content,
    galleryCategories,
    listing,
    recommendedVillas,
    settings,
  };

  const enabledRows = layout.rows.filter((row) => row.enabled);
  const renderedRows: ReactNode[] = [];

  for (let rowIndex = 0; rowIndex < enabledRows.length; rowIndex += 1) {
    const row = enabledRows[rowIndex];
    const blocks = renderRowBlocks(row, context);

    if (blocks.length === 0) {
      continue;
    }

    if (isLockedFullWidthRow(blocks) || !isSplitRow(row, blocks)) {
      renderedRows.push(renderStandardRow(row, blocks));
      continue;
    }

    const ratio = row.ratio;
    const wideRows: RenderedDetailLayoutBlock[][] = [];
    const narrowBlocks: RenderedDetailLayoutBlock[] = [];
    const [firstBlock, secondBlock, ...remainingBlocks] = blocks;

    if (ratio === "70/30") {
      wideRows.push([firstBlock]);
      narrowBlocks.push(secondBlock);
    } else {
      narrowBlocks.push(firstBlock);
      wideRows.push([secondBlock]);
    }

    appendWideRows(wideRows, remainingBlocks);

    let nextRowIndex = rowIndex + 1;

    while (nextRowIndex < enabledRows.length) {
      const nextRow = enabledRows[nextRowIndex];
      const nextBlocks = renderRowBlocks(nextRow, context);

      if (nextBlocks.length === 0) {
        nextRowIndex += 1;
        continue;
      }

      if (isLockedFullWidthRow(nextBlocks) || isSplitRow(nextRow, nextBlocks)) {
        break;
      }

      appendWideRows(wideRows, nextBlocks);
      nextRowIndex += 1;
    }

    renderedRows.push(
      renderSplitSection({
        id: row.id,
        narrowBlocks,
        ratio,
        wideRows,
      }),
    );

    rowIndex = nextRowIndex - 1;
  }

  if (renderedRows.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto grid w-full max-w-[402px] gap-6 px-[22.5px] pb-10 sm:max-w-7xl sm:px-6 lg:px-8">
      {renderedRows}
    </div>
  );
}
