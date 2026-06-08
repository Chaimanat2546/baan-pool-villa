export const DETAIL_LAYOUT_BLOCK_TYPES = [
  "details",
  "bedrooms",
  "pool",
  "kitchen",
  "amenities",
  "categorized_images",
  "costs_promotions",
  "rules_pet_policy",
  "map_nearby",
  "review_videos",
  "booking_contact",
  "recommended_villas",
] as const;

export type DetailLayoutBlockType =
  (typeof DETAIL_LAYOUT_BLOCK_TYPES)[number];

export type DetailLayoutColumns = 1 | 2 | 3;

export type DetailLayoutRatio =
  | "50/50"
  | "60/40"
  | "70/30"
  | "40/60"
  | "30/70";

export type DetailLayoutOuterRatio = "70/30" | "30/70";

export type DetailLayoutWideRatio = "50/50";

export type DetailLayoutWideColumns = 1 | 2;

export type DetailLayoutLockedTop = ["gallery", "intro"];

export interface DetailLayoutBlock {
  type: DetailLayoutBlockType;
  title: string;
  enabled: boolean;
  hideWhenEmpty: boolean;
}

export interface DetailLayoutRow {
  id: string;
  columns: DetailLayoutColumns;
  ratio?: DetailLayoutRatio;
  enabled: boolean;
  blocks: DetailLayoutBlock[];
}

export interface DetailLayoutV1Config {
  version: 1;
  lockedTop: DetailLayoutLockedTop;
  rows: DetailLayoutRow[];
}

export interface DetailLayoutWideRow {
  id: string;
  columns: DetailLayoutWideColumns;
  ratio?: DetailLayoutWideRatio;
  enabled: boolean;
  blocks: DetailLayoutBlock[];
}

export interface DetailLayoutNarrowRow {
  id: string;
  enabled: boolean;
  block: DetailLayoutBlock;
}

export interface DetailLayoutMainSplit {
  ratio: DetailLayoutOuterRatio;
  wideRows: DetailLayoutWideRow[];
  narrowRows: DetailLayoutNarrowRow[];
}

export interface DetailLayoutV2Config {
  version: 2;
  lockedTop: DetailLayoutLockedTop;
  mainSplit: DetailLayoutMainSplit;
  lockedBottom: DetailLayoutBlock[];
}

export type DetailLayoutConfig = DetailLayoutV1Config;

export type AnyDetailLayoutConfig = DetailLayoutV1Config | DetailLayoutV2Config;

export interface DetailLayoutValidationResult {
  ok: boolean;
  errors: string[];
  layout: DetailLayoutConfig;
}

export interface DetailLayoutV2ValidationResult {
  ok: boolean;
  errors: string[];
  layout: DetailLayoutV2Config;
}

export interface AnyDetailLayoutValidationResult {
  ok: boolean;
  errors: string[];
  layout: AnyDetailLayoutConfig;
}
