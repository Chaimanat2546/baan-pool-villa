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

export type DetailLayoutLockedTop = "gallery" | "intro";

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

export interface DetailLayoutConfig {
  version: 1;
  lockedTop: DetailLayoutLockedTop[];
  rows: DetailLayoutRow[];
}

export interface DetailLayoutValidationResult {
  ok: boolean;
  errors: string[];
  layout: DetailLayoutConfig;
}
