import type {
  DetailLayoutBlock,
  DetailLayoutBlockType,
  DetailLayoutColumns,
  DetailLayoutConfig,
  DetailLayoutRatio,
  DetailLayoutRow,
} from "@/lib/detail-layout/types";

export interface AdminDetailLayoutResponse {
  code?: string;
  details?: string;
  error?: string;
  errors?: string[];
  hint?: string;
  layout?: DetailLayoutConfig;
}

export type DetailLayoutDraftSlot = DetailLayoutBlock | null;

export interface DetailLayoutDraftRow
  extends Omit<DetailLayoutRow, "blocks"> {
  blocks: DetailLayoutDraftSlot[];
}

export interface DetailLayoutDraft
  extends Omit<DetailLayoutConfig, "rows"> {
  rows: DetailLayoutDraftRow[];
}

export type {
  DetailLayoutBlock,
  DetailLayoutBlockType,
  DetailLayoutColumns,
  DetailLayoutConfig,
  DetailLayoutRatio,
  DetailLayoutRow,
};
