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

export type DetailLayoutDraft = DetailLayoutConfig;

export type {
  DetailLayoutBlock,
  DetailLayoutBlockType,
  DetailLayoutColumns,
  DetailLayoutConfig,
  DetailLayoutRatio,
  DetailLayoutRow,
};
