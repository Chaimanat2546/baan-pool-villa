import type { VillaListing } from "../villas/types";

export const FIXED_HOME_SECTION_KEYS = [
  "why_choose",
  "tiktok",
  "customer_reviews",
  "articles",
  "faq",
  "contact",
] as const;

export type FixedHomeSectionKey = (typeof FIXED_HOME_SECTION_KEYS)[number];

export type HomePageLayoutItem =
  | { kind: "fixed"; key: FixedHomeSectionKey; enabled: boolean }
  | { kind: "rail"; key: string; enabled: boolean };

export interface HomePageLayoutResult {
  degraded: boolean;
  items: HomePageLayoutItem[];
  source: "config" | "fallback";
}

export type HomeSectionMode = "manual" | "near_sea" | "slice";

export type HomeSectionFallbackMode = "none" | "fill_from_all" | "fill_near_sea";

export interface HomeSectionItemDraft {
  houseId: string;
  isActive: boolean;
}

export type HomeSectionDraft = {
  slug: string;
  title: string;
  description: string;
  mode: HomeSectionMode;
  limitCount: number;
  autoScrollEnabled: boolean;
  fallbackMode: HomeSectionFallbackMode;
  sliceOffset: number;
  isActive: boolean;
  ctaEnabled: boolean;
  ctaLabel: string;
  ctaHref: string;
  items: HomeSectionItemDraft[];
};

export interface HomeSectionSaveItem {
  houseId: string;
  position: number;
  isActive: boolean;
}

export type HomeSectionSavePayload = {
  slug: string;
  title: string;
  description: string;
  mode: HomeSectionMode;
  fallbackMode: HomeSectionFallbackMode;
  sliceOffset: number;
  isActive: boolean;
  limitCount: number;
  autoScrollEnabled: boolean;
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
  autoScrollEnabled: boolean;
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
  autoScrollEnabled: boolean;
  cta?: {
    label: string;
    href: string;
  };
  villas: VillaListing[];
};
