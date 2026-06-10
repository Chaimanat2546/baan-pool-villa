import type {
  AnyDetailLayoutConfig,
  DetailLayoutBlock,
  DetailLayoutBlockType,
  DetailLayoutConfig,
  DetailLayoutNarrowRow,
  DetailLayoutRatio,
  DetailLayoutRow,
  DetailLayoutV2Config,
  DetailLayoutWideRatio,
  DetailLayoutWideRow,
} from "@/lib/detail-layout/types";
import type { SiteSettings } from "@/lib/site-settings/types";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { RecommendedVillaSection, VillaListing } from "@/lib/villas/types";
import type { ReactNode } from "react";
import { renderDetailLayoutBlock } from "./detail-layout-blocks";
import type { GalleryCategory } from "./types";

export interface DetailLayoutRendererProps {
  content: VillaDetailContent;
  galleryCategories: GalleryCategory[];
  layout: AnyDetailLayoutConfig;
  listing: VillaListing;
  recommendedSection: RecommendedVillaSection | null;
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

type RenderedDetailLayoutWideRow = {
  blocks: RenderedDetailLayoutBlock[];
  columns: DetailLayoutWideRow["columns"];
  id: string;
  ratio?: DetailLayoutWideRatio;
};

interface DetailLayoutRenderContext {
  content: VillaDetailContent;
  galleryCategories: GalleryCategory[];
  listing: VillaListing;
  recommendedSection: RecommendedVillaSection | null;
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
  return renderBlocks(row.id, row.blocks, context);
}

function renderBlocks(
  rowId: string,
  blocks: DetailLayoutBlock[],
  context: DetailLayoutRenderContext,
): RenderedDetailLayoutBlock[] {
  const renderedBlocks: RenderedDetailLayoutBlock[] = [];

  blocks.forEach((block, blockIndex) => {
    if (!block.enabled) {
      return;
    }

    const node = renderDetailLayoutBlock(block, context);

    if (node === null) {
      return;
    }

    renderedBlocks.push({
      key: `${rowId}-${block.type}-${blockIndex}`,
      node,
      type: block.type,
    });
  });

  return renderedBlocks;
}

function renderNarrowRowBlock(
  row: DetailLayoutNarrowRow,
  context: DetailLayoutRenderContext,
): RenderedDetailLayoutBlock | null {
  return renderBlocks(row.id, [row.block], context)[0] ?? null;
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

function renderV1Layout(
  layout: DetailLayoutConfig,
  context: DetailLayoutRenderContext,
) {
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

  return renderedRows;
}

function renderV2WideFullRow(row: RenderedDetailLayoutWideRow) {
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

function splitV2WideColumns(rows: RenderedDetailLayoutWideRow[]) {
  const leftColumn: RenderedDetailLayoutBlock[] = [];
  const rightColumn: RenderedDetailLayoutBlock[] = [];

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

function renderV2WideStackGroup(
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

function renderV2WideArea(rows: RenderedDetailLayoutWideRow[]) {
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

function renderV2NarrowArea(blocks: RenderedDetailLayoutBlock[]) {
  if (blocks.length === 0) {
    return null;
  }

  return renderNarrowArea(blocks);
}

function renderV2LockedBottom(blocks: RenderedDetailLayoutBlock[]) {
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

function renderV2Layout(
  layout: DetailLayoutV2Config,
  context: DetailLayoutRenderContext,
) {
  const wideRows = layout.mainSplit.wideRows.flatMap((row) => {
    if (!row.enabled) {
      return [];
    }

    const blocks = renderBlocks(row.id, row.blocks, context);

    if (blocks.length === 0) {
      return [];
    }

    return [
      {
        blocks,
        columns: row.columns,
        id: row.id,
        ...(row.ratio === undefined ? {} : { ratio: row.ratio }),
      },
    ];
  });

  const narrowBlocks = layout.mainSplit.narrowRows.flatMap((row) => {
    if (!row.enabled) {
      return [];
    }

    const block = renderNarrowRowBlock(row, context);

    return block === null ? [] : [block];
  });

  const lockedBottomBlocks = renderBlocks(
    "lockedBottom",
    layout.lockedBottom,
    context,
  );
  const wideArea = renderV2WideArea(wideRows);
  const narrowArea = renderV2NarrowArea(narrowBlocks);
  const lockedBottom = renderV2LockedBottom(lockedBottomBlocks);
  const splitContent =
    wideArea === null && narrowArea === null ? null : (
      <div
        key="split-v2-main"
        className={`grid min-w-0 items-start gap-6 ${ratioGridClassMap[layout.mainSplit.ratio]}`}
        data-detail-layout-split="mainSplit"
        data-detail-layout-split-ratio={layout.mainSplit.ratio}
      >
        {layout.mainSplit.ratio === "70/30" ? (
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
  const renderedRows: ReactNode[] = [];

  if (splitContent !== null) {
    renderedRows.push(splitContent);
  }

  if (lockedBottom !== null) {
    renderedRows.push(lockedBottom);
  }

  return renderedRows;
}

export function DetailLayoutRenderer({
  content,
  galleryCategories,
  layout,
  listing,
  recommendedSection,
  settings,
}: DetailLayoutRendererProps) {
  const context = {
    content,
    galleryCategories,
    listing,
    recommendedSection,
    settings,
  };
  const renderedRows =
    layout.version === 2
      ? renderV2Layout(layout, context)
      : renderV1Layout(layout, context);

  if (renderedRows.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto grid w-full max-w-[402px] gap-6 px-[22.5px] pb-10 sm:max-w-7xl sm:px-6 lg:px-8">
      {renderedRows}
    </div>
  );
}
