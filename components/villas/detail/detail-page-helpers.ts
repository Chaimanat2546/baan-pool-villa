import type {
  AnyDetailLayoutConfig,
  DetailLayoutBlock,
  DetailLayoutBlockType,
} from "@/lib/detail-layout/types";
import type { PublicVillaImage } from "@/lib/villas/public-dto";

export type GalleryLoadStatus = "idle" | "preview" | "loading" | "loaded" | "error";
export type GalleryLoadMode = "background" | "interactive";

export interface GalleryLoadState {
  error: string | null;
  images: PublicVillaImage[];
  status: GalleryLoadStatus;
  villaId: string;
}

export interface LoadGalleryImagesOptions {
  mode?: GalleryLoadMode;
}

export function getInitialGalleryLoadState(villaId: string): GalleryLoadState {
  return {
    error: null,
    images: [],
    status: "idle",
    villaId,
  };
}

export function getPreviewGalleryLoadState(
  villaId: string,
  images: PublicVillaImage[],
): GalleryLoadState {
  return {
    error: null,
    images,
    status: "preview",
    villaId,
  };
}

export function getActiveGalleryLoadState(
  state: GalleryLoadState,
  villaId: string,
): GalleryLoadState {
  return state.villaId === villaId ? state : getInitialGalleryLoadState(villaId);
}

function hasEnabledBlockType(
  block: DetailLayoutBlock,
  type: DetailLayoutBlockType,
): boolean {
  return block.enabled && block.type === type;
}

export function hasEnabledDetailLayoutBlock(
  layout: AnyDetailLayoutConfig,
  type: DetailLayoutBlockType,
): boolean {
  if (layout.version === 2) {
    return (
      layout.mainSplit.wideRows.some((row) =>
        row.enabled && row.blocks.some((block) => hasEnabledBlockType(block, type)),
      ) ||
      layout.mainSplit.narrowRows.some(
        (row) => row.enabled && hasEnabledBlockType(row.block, type),
      ) ||
      layout.lockedBottom.some((block) => hasEnabledBlockType(block, type))
    );
  }

  return layout.rows.some(
    (row) => row.enabled && row.blocks.some((block) => hasEnabledBlockType(block, type)),
  );
}

export function hasEnabledBookingContact(layout: AnyDetailLayoutConfig): boolean {
  return hasEnabledDetailLayoutBlock(layout, "booking_contact");
}
