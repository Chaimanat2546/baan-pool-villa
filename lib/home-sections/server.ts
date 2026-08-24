import "server-only";

import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { createHomeConfigCachedLoader } from "./cache";
import {
  buildDefaultHomePageLayout,
  parseHomePageLayout,
  validateHomePageLayout,
} from "./layout";
import { buildFallbackHomeSections, resolveHomeSections } from "./resolve";
import { createHomeConfigClient } from "./supabase";
import type {
  HomePageLayoutResult,
  HomeSectionConfig,
  HomeSectionFallbackMode,
  HomeSectionMode,
  ResolvedHomeSection,
} from "./types";
import type { VillaListing } from "../villas/types";

export type HomeSectionsSource = "config" | "fallback";
export type HomeSectionsFallbackReason =
  | "config_unavailable"
  | "empty_config";

export interface ResolvedHomeSectionsResult {
  degraded: boolean;
  fallbackReason?: HomeSectionsFallbackReason;
  sections: ResolvedHomeSection[];
  source: HomeSectionsSource;
}

export interface HomeSectionListingPlan {
  configs: HomeSectionConfig[];
  houseIds: string[];
  layout: HomePageLayoutResult;
  listingLimit: number;
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
  auto_scroll_enabled: unknown;
  display_order: unknown;
  cta_enabled: unknown;
  cta_label: unknown;
  cta_href: unknown;
  home_section_items: unknown;
}

const HOME_SECTIONS_SELECT =
  "slug,title,description,mode,fallback_mode,slice_offset,is_active,limit_count,auto_scroll_enabled,display_order,cta_enabled,cta_label,cta_href,home_section_items(house_id,position,is_active)";
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
    autoScrollEnabled: row.auto_scroll_enabled === true,
    displayOrder,
    ctaEnabled: row.cta_enabled,
    ctaLabel: toNullableString(row.cta_label),
    ctaHref: toNullableString(row.cta_href),
    items: row.home_section_items.map((item) =>
      mapHomeSectionItemRow(item as HomeSectionItemRow),
    ),
  };
}

const fetchCachedHomeSectionConfigs = createHomeConfigCachedLoader(
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

const fetchCachedHomePageLayout = createHomeConfigCachedLoader(
  async (): Promise<unknown> => {
    const { data, error } = await createHomeConfigClient()
      .from("home_page_layout")
      .select("layout")
      .eq("id", "main")
      .maybeSingle();

    if (error || !data) {
      throw new Error("Home page layout is unavailable");
    }

    return data.layout;
  },
  [CACHE_TAGS.homeSections, "layout"],
  {
    revalidate: CACHE_REVALIDATE_SECONDS.homeSections,
    tags: [CACHE_TAGS.homeSections],
  },
);

function getHomeSectionHouseIds(configs: HomeSectionConfig[]): string[] {
  const ids = new Set<string>();

  for (const section of configs) {
    if (!section.isActive) {
      continue;
    }

    for (const item of section.items) {
      if (item.isActive) {
        ids.add(item.houseId);
      }
    }
  }

  return [...ids];
}

export function getHomeSectionListingLimit(
  configs: HomeSectionConfig[],
  minimumListingLimit = 0,
): number {
  let listingLimit = Math.max(0, Math.trunc(minimumListingLimit));

  for (const section of configs) {
    if (!section.isActive) {
      continue;
    }

    const sliceOffset = Math.max(0, Math.trunc(section.sliceOffset));
    const limitCount = Math.max(1, Math.trunc(section.limitCount));
    listingLimit = Math.max(listingLimit, sliceOffset + limitCount);
  }

  return listingLimit;
}

export async function getHomeSectionListingPlan(
  minimumListingLimit = 0,
): Promise<HomeSectionListingPlan> {
  const [configs, layoutResult] = await Promise.all([
    fetchCachedHomeSectionConfigs(),
    fetchCachedHomePageLayout().then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason) => ({ reason, status: "rejected" as const }),
    ),
  ]);
  let layout: HomePageLayoutResult;

  try {
    if (layoutResult.status === "rejected") {
      throw layoutResult.reason;
    }

    const parsed = parseHomePageLayout(layoutResult.value);
    const railSlugs = parsed.items
      .filter((item) => item.kind === "rail")
      .map((item) => item.key);
    const errors = [
      ...parsed.errors,
      ...validateHomePageLayout(parsed.items, railSlugs),
    ];

    if (errors.length > 0) {
      throw new Error("Home page layout is invalid");
    }

    layout = {
      degraded: false,
      items: parsed.items,
      source: "config",
    };
  } catch (error) {
    console.error(
      "Unable to load home page layout",
      error instanceof Error
        ? error
        : new Error("Home page layout is unavailable"),
    );
    layout = {
      degraded: true,
      items: buildDefaultHomePageLayout(configs.map(({ slug }) => slug)),
      source: "fallback",
    };
  }

  return {
    configs,
    houseIds: getHomeSectionHouseIds(configs),
    layout,
    listingLimit: getHomeSectionListingLimit(configs, minimumListingLimit),
  };
}

export async function getActiveHomeSectionHouseIds(): Promise<string[]> {
  const configs = await fetchCachedHomeSectionConfigs();
  return getHomeSectionHouseIds(configs);
}

type ConfiguredHomeSectionsResult =
  | {
      sections: ResolvedHomeSection[];
      status: "config";
    }
  | {
      degraded: boolean;
      reason: HomeSectionsFallbackReason;
      status: "fallback";
    };

async function fetchConfiguredHomeSections(
  villas: VillaListing[],
  fallbackOnEmpty: boolean,
): Promise<ConfiguredHomeSectionsResult> {
  try {
    const configs = await fetchCachedHomeSectionConfigs();
    return resolveConfiguredHomeSections(configs, villas, fallbackOnEmpty);
  } catch (error) {
    // Treat config failures as a degraded fallback path so the homepage can
    // still render curated default sections instead of failing closed.
    const reportedError =
      error instanceof Error
        ? error
        : new Error("Home section config is unavailable");
    console.error("Unable to load home section config", reportedError);

    return {
      degraded: true,
      reason: "config_unavailable",
      status: "fallback",
    };
  }
}

function resolveConfiguredHomeSections(
  configs: HomeSectionConfig[],
  villas: VillaListing[],
  fallbackOnEmpty: boolean,
): ConfiguredHomeSectionsResult {
  const sections = resolveHomeSections(configs, villas);

  if (sections.length > 0 || !fallbackOnEmpty) {
    return { sections, status: "config" };
  }

  return { degraded: false, reason: "empty_config", status: "fallback" };
}

/**
 * Resolves homepage villa sections from CMS config and falls back to built-in
 * sections when config is empty or unavailable.
 *
 * @param villas - The normalized villa catalog available for homepage section
 * resolution.
 * @returns The resolved homepage sections, including whether the result is
 * degraded and whether it came from config or fallback logic.
 */
export async function getResolvedHomeSections(
  villas: VillaListing[],
  configs?: HomeSectionConfig[],
  fallbackOnEmpty = true,
): Promise<ResolvedHomeSectionsResult> {
  const sections = configs
    ? resolveConfiguredHomeSections(configs, villas, fallbackOnEmpty)
    : await fetchConfiguredHomeSections(villas, fallbackOnEmpty);

  if (sections.status === "config") {
    return { degraded: false, sections: sections.sections, source: "config" };
  }

  return {
    degraded: sections.degraded,
    fallbackReason: sections.reason,
    sections: buildFallbackHomeSections(villas),
    source: "fallback",
  };
}
