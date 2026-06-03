import "server-only";

import { unstable_cache } from "next/cache";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { buildFallbackHomeSections, resolveHomeSections } from "./resolve";
import { createHomeConfigClient } from "./supabase";
import type {
  HomeSectionConfig,
  HomeSectionFallbackMode,
  HomeSectionMode,
  ResolvedHomeSection,
} from "./types";
import type { VillaListing } from "../villas/types";

export type HomeSectionsSource = "config" | "fallback";

export interface ResolvedHomeSectionsResult {
  sections: ResolvedHomeSection[];
  source: HomeSectionsSource;
}

interface HomeSectionItemRow {
  house_id: unknown;
  position: unknown;
  is_active: unknown;
}

interface HomeSectionRow {
  slug: unknown;
  title: unknown;
  description: unknown;
  mode: unknown;
  fallback_mode: unknown;
  slice_offset: unknown;
  is_active: unknown;
  limit_count: unknown;
  display_order: unknown;
  cta_enabled: unknown;
  cta_label: unknown;
  cta_href: unknown;
  home_section_items: unknown;
}

const HOME_SECTIONS_SELECT =
  "slug,title,description,mode,fallback_mode,slice_offset,is_active,limit_count,display_order,cta_enabled,cta_label,cta_href,home_section_items(house_id,position,is_active)";
const HOME_SECTION_MODES = new Set<HomeSectionMode>([
  "manual",
  "near_sea",
  "slice",
]);
const HOME_SECTION_FALLBACK_MODES = new Set<HomeSectionFallbackMode>([
  "none",
  "fill_from_all",
  "fill_near_sea",
]);

function isHomeSectionMode(value: unknown): value is HomeSectionMode {
  return typeof value === "string" && HOME_SECTION_MODES.has(value as HomeSectionMode);
}

function isHomeSectionFallbackMode(
  value: unknown,
): value is HomeSectionFallbackMode {
  return (
    typeof value === "string" &&
    HOME_SECTION_FALLBACK_MODES.has(value as HomeSectionFallbackMode)
  );
}

function toNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === "string" ? value : null;
}

function mapHomeSectionItemRow(
  row: HomeSectionItemRow,
): HomeSectionConfig["items"][number] {
  if (typeof row.house_id !== "string" || typeof row.is_active !== "boolean") {
    throw new Error("Invalid home section item row");
  }

  const position = toNumber(row.position);

  if (position === null) {
    throw new Error("Invalid home section item position");
  }

  return {
    houseId: row.house_id,
    position,
    isActive: row.is_active,
  };
}

function mapHomeSectionRow(row: HomeSectionRow): HomeSectionConfig {
  const displayOrder = toNumber(row.display_order);
  const limitCount = toNumber(row.limit_count);
  const sliceOffset = toNumber(row.slice_offset);

  if (
    typeof row.slug !== "string" ||
    typeof row.title !== "string" ||
    typeof row.description !== "string" ||
    !isHomeSectionMode(row.mode) ||
    !isHomeSectionFallbackMode(row.fallback_mode) ||
    typeof row.is_active !== "boolean" ||
    typeof row.cta_enabled !== "boolean" ||
    displayOrder === null ||
    limitCount === null ||
    sliceOffset === null ||
    !Array.isArray(row.home_section_items)
  ) {
    throw new Error("Invalid home section row");
  }

  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    mode: row.mode,
    fallbackMode: row.fallback_mode,
    sliceOffset,
    isActive: row.is_active,
    limitCount,
    displayOrder,
    ctaEnabled: row.cta_enabled,
    ctaLabel: toNullableString(row.cta_label),
    ctaHref: toNullableString(row.cta_href),
    items: row.home_section_items.map((item) =>
      mapHomeSectionItemRow(item as HomeSectionItemRow),
    ),
  };
}

const fetchCachedHomeSectionConfigs = unstable_cache(
  async (): Promise<HomeSectionConfig[]> => {
    const { data, error } = await createHomeConfigClient()
      .from("home_sections")
      .select(HOME_SECTIONS_SELECT)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("position", {
        ascending: true,
        referencedTable: "home_section_items",
      });

    if (error || !Array.isArray(data)) {
      throw new Error("Home section config is unavailable");
    }

    return (data as HomeSectionRow[]).map(mapHomeSectionRow);
  },
  [CACHE_TAGS.homeSections],
  {
    revalidate: CACHE_REVALIDATE_SECONDS.homeSections,
    tags: [CACHE_TAGS.homeSections],
  },
);

async function fetchConfiguredHomeSections(
  villas: VillaListing[],
): Promise<ResolvedHomeSection[] | null> {
  try {
    const configs = await fetchCachedHomeSectionConfigs();
    const sections = resolveHomeSections(configs, villas);

    return sections.length > 0 ? sections : null;
  } catch {
    return null;
  }
}

export async function getResolvedHomeSections(
  villas: VillaListing[],
): Promise<ResolvedHomeSectionsResult> {
  const sections = await fetchConfiguredHomeSections(villas);

  if (sections) {
    return { sections, source: "config" };
  }

  return {
    sections: buildFallbackHomeSections(villas),
    source: "fallback",
  };
}
