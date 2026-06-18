import type {
  AnyDetailLayoutConfig,
  DetailLayoutBlock,
  DetailLayoutConfig,
  DetailLayoutNarrowRow,
  DetailLayoutRow,
  DetailLayoutV2Config,
} from "@/lib/detail-layout/types";
import type { SiteSettings } from "@/lib/site-settings/types";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { RecommendedVillaSection, VillaListing } from "@/lib/villas/types";
import type { ReactNode } from "react";
import { renderDetailLayoutBlock } from "./detail-layout-blocks";
import {
  appendWideRows,
  isLockedFullWidthRow,
  isSplitRow,
  ratioGridClassMap,
} from "./detail-layout-renderer-helpers";
import {
  renderSplitSection,
  renderStandardRow,
  renderV2LockedBottom,
  renderV2NarrowArea,
  renderV2WideArea,
  type RenderedDetailLayoutBlock,
} from "./detail-layout-renderer-parts";
import type { GalleryCategory } from "./types";

export interface DetailLayoutRendererProps {
  bookingSidebarId?: string;
  content: VillaDetailContent;
  galleryCategories: GalleryCategory[];
  layout: AnyDetailLayoutConfig;
  listing: VillaListing;
  recommendedSection: RecommendedVillaSection | null;
  settings: SiteSettings;
}

interface DetailLayoutRenderContext {
  bookingSidebarId?: string;
  content: VillaDetailContent;
  galleryCategories: GalleryCategory[];
  listing: VillaListing;
  recommendedSection: RecommendedVillaSection | null;
  settings: SiteSettings;
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
  bookingSidebarId,
  content,
  galleryCategories,
  layout,
  listing,
  recommendedSection,
  settings,
}: DetailLayoutRendererProps) {
  const context = {
    bookingSidebarId,
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
