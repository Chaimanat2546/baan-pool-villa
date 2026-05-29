import type {
  DetailLayoutConfig,
  DetailLayoutRatio,
  DetailLayoutRow,
} from "@/lib/detail-layout/types";
import type { SiteSettings } from "@/lib/site-settings/types";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { VillaListing } from "@/lib/villas/types";
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

  const renderedRows = layout.rows
    .filter((row) => row.enabled)
    .map((row) => {
      const blocks = row.blocks
        .filter((block) => block.enabled)
        .map((block) => ({
          key: `${row.id}-${block.type}`,
          node: renderDetailLayoutBlock(block, context),
        }))
        .filter((block) => block.node !== null);

      if (blocks.length === 0) {
        return null;
      }

      return (
        <div
          key={row.id}
          className={`grid min-w-0 gap-6 ${getRowGridClass(row, blocks.length)}`}
        >
          {blocks.map((block) => (
            <div key={block.key} className="min-w-0">
              {block.node}
            </div>
          ))}
        </div>
      );
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (renderedRows.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto grid w-full max-w-[402px] gap-6 px-[22.5px] pb-10 sm:max-w-7xl sm:px-6 lg:px-8">
      {renderedRows}
    </div>
  );
}
