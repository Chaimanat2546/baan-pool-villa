import type { VillaListing } from "../villas/types";

export type HomeSectionMode = "manual" | "near_sea" | "slice";

export type HomeSectionFallbackMode = "none" | "fill_from_all" | "fill_near_sea";

export type HomeSectionItemDraft = {
  houseId: string;
};

export type HomeSectionDraft = {
  slug: string;
  title: string;
  description: string;
  mode: HomeSectionMode;
  limitCount: number;
  fallbackMode: HomeSectionFallbackMode;
  sliceOffset: number;
  isActive: boolean;
  ctaEnabled: boolean;
  ctaLabel: string;
  ctaHref: string;
  items: HomeSectionItemDraft[];
};

export type HomeSectionSaveItem = {
  houseId: string;
  position: number;
};

export type HomeSectionSavePayload = {
  slug: string;
  title: string;
  description: string;
  mode: HomeSectionMode;
  fallbackMode: HomeSectionFallbackMode;
  sliceOffset: number;
  isActive: boolean;
  limitCount: number;
  display_order: number;
  ctaLabel: string | null;
  ctaHref: string | null;
  items: HomeSectionSaveItem[];
};

export type HomeSectionConfigItem = {
  houseId: string;
  position: number;
  isActive: boolean;
};

export type HomeSectionConfig = {
  slug: string;
  title: string;
  description: string;
  mode: HomeSectionMode;
  fallbackMode: HomeSectionFallbackMode;
  sliceOffset: number;
  isActive: boolean;
  limitCount: number;
  displayOrder: number;
  ctaEnabled: boolean;
  ctaLabel: string | null;
  ctaHref: string | null;
  items: HomeSectionConfigItem[];
};

export type ResolvedHomeSection = {
  slug: string;
  title: string;
  description: string;
  cta?: {
    label: string;
    href: string;
  };
  villas: VillaListing[];
};
