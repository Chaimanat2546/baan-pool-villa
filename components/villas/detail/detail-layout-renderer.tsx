import type {
  AnyDetailLayoutConfig,
  DetailLayoutBlock,
  DetailLayoutNarrowRow,
  DetailLayoutV2Config,
} from "@/lib/detail-layout/types";
import type { PublicAdvertisement } from "@/lib/advertisements/types";
import type { SiteSettings } from "@/lib/site-settings/types";
import type { SiteContactSettings } from "@/lib/site-contact-settings/types";
import type {
  GalleryStyleSettings,
  SiteVillaCardStyle,
} from "@/lib/site-web-styles/types";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { BookingCalendarMonth } from "@/lib/villas/booking-calendar";
import type { RecommendedVillaSection, VillaListing } from "@/lib/villas/types";
import type { ReactNode } from "react";
import { renderDetailLayoutBlock } from "./detail-layout-blocks";
import { ratioGridClassMap } from "./detail-layout-renderer-helpers";
import { convertDetailLayoutV1ToV2 } from "@/lib/detail-layout/version-2";
import {
  renderV2LockedBottom,
  renderV2NarrowArea,
  renderV2WideArea,
  type RenderedDetailLayoutBlock,
} from "./detail-layout-renderer-parts";
import type { GalleryCategory } from "./types";

export interface DetailLayoutRendererProps {
  advertisements: PublicAdvertisement[];
  bookingCalendars: Record<string, BookingCalendarMonth>;
  bookingSidebarId?: string;
  contactSettings: SiteContactSettings;
  content: VillaDetailContent;
  currentBookingMonthKey: string;
  galleryCategories: GalleryCategory[];
  galleryStyle: GalleryStyleSettings;
  layout: AnyDetailLayoutConfig;
  listing: VillaListing;
  recommendedSection: RecommendedVillaSection | null;
  settings: SiteSettings;
  villaCardStyle?: SiteVillaCardStyle;
}

interface DetailLayoutRenderContext {
  advertisements: PublicAdvertisement[];
  bookingCalendars: Record<string, BookingCalendarMonth>;
  bookingSidebarId?: string;
  contactSettings: SiteContactSettings;
  content: VillaDetailContent;
  currentBookingMonthKey: string;
  galleryCategories: GalleryCategory[];
  galleryStyle: GalleryStyleSettings;
  listing: VillaListing;
  recommendedSection: RecommendedVillaSection | null;
  settings: SiteSettings;
  villaCardStyle?: SiteVillaCardStyle;
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
      slotIndex: blockIndex,
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
        className={`grid min-w-0 items-start gap-6 ${wideArea !== null && narrowArea !== null ? ratioGridClassMap[layout.mainSplit.ratio] : "lg:grid-cols-1"}`}
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
  advertisements,
  bookingCalendars,
  bookingSidebarId,
  contactSettings,
  content,
  currentBookingMonthKey,
  galleryCategories,
  galleryStyle,
  layout,
  listing,
  recommendedSection,
  settings,
  villaCardStyle,
}: DetailLayoutRendererProps) {
  const context = {
    advertisements,
    bookingCalendars,
    bookingSidebarId,
    contactSettings,
    content,
    currentBookingMonthKey,
    galleryCategories,
    galleryStyle,
    listing,
    recommendedSection,
    settings,
    villaCardStyle,
  };
  const displayLayout = layout.version === 2 ? layout : convertDetailLayoutV1ToV2({
    ...layout,
    rows: layout.rows.filter((row) => row.enabled),
  }, false);
  const renderedRows = renderV2Layout(displayLayout, context);

  if (renderedRows.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto grid w-full max-w-[402px] gap-6 px-[22.5px] pb-10 sm:max-w-7xl sm:px-6 lg:px-8">
      {renderedRows}
    </div>
  );
}
