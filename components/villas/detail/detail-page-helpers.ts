import type {
  AnyDetailLayoutConfig,
  DetailLayoutBlock,
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

function hasEnabledBookingContactBlock(block: DetailLayoutBlock): boolean {
  return block.enabled && block.type === "booking_contact";
}

export function hasEnabledBookingContact(layout: AnyDetailLayoutConfig): boolean {
  if (layout.version === 2) {
    return (
      layout.mainSplit.wideRows.some((row) =>
        row.enabled && row.blocks.some(hasEnabledBookingContactBlock),
      ) ||
      layout.mainSplit.narrowRows.some(
        (row) => row.enabled && hasEnabledBookingContactBlock(row.block),
      ) ||
      layout.lockedBottom.some(hasEnabledBookingContactBlock)
    );
  }

  return layout.rows.some(
    (row) => row.enabled && row.blocks.some(hasEnabledBookingContactBlock),
  );
}
