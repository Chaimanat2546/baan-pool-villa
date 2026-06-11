import type {
  HomeSectionDraft,
  HomeSectionFallbackMode,
  HomeSectionMode,
  HomeSectionSavePayload,
} from "@/lib/home-sections/types";
import { revalidateHomeSectionsCache } from "@/lib/cache-revalidation";
import {
  normalizeHomeSectionDraftsForSave,
  validateHomeSectionDrafts,
} from "@/lib/home-sections/validation";
import {
  adminSupabaseErrorResponse,
  requireHomeConfigAdmin,
} from "@/lib/admin/route-helpers";

import { jsonError } from "./auth";

interface HomeSectionItemRow {
  house_id: unknown;
  position: unknown;
  is_active: unknown;
}

interface HomeSectionRow {
  slug: unknown;
  title: unknown;
  description: unknown;
  display_order: unknown;
  is_active: unknown;
  mode: unknown;
  limit_count: unknown;
  cta_enabled: unknown;
  cta_label: unknown;
  cta_href: unknown;
  fallback_mode: unknown;
  slice_offset: unknown;
  home_section_items: unknown;
}

type AdminHomeSectionItemDraft = HomeSectionDraft["items"][number] & {
  position: number;
  isActive: boolean;
};

type AdminHomeSectionDraft = Omit<HomeSectionDraft, "items"> & {
  displayOrder: number;
  items: AdminHomeSectionItemDraft[];
};

interface RpcHomeSectionItemPayload {
  house_id: string;
  position: number;
  is_active: boolean;
}

interface RpcHomeSectionPayload {
  slug: string;
  title: string;
  description: string;
  mode: HomeSectionMode;
  fallback_mode: HomeSectionFallbackMode;
  slice_offset: number;
  is_active: boolean;
  limit_count: number;
  display_order: number;
  cta_enabled: boolean;
  cta_label: string | null;
  cta_href: string | null;
  items: RpcHomeSectionItemPayload[];
}

type ParsedSectionsPayload =
  | {
      sections: HomeSectionDraft[];
      errors: [];
    }
  | {
      sections: [];
      errors: string[];
    };

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

function toString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mapHomeSectionItemRow(row: HomeSectionItemRow): AdminHomeSectionItemDraft {
  const position = toNumber(row.position);

  if (
    typeof row.house_id !== "string" ||
    position === null ||
    typeof row.is_active !== "boolean"
  ) {
    throw new Error("Invalid home section item row");
  }

  return {
    houseId: row.house_id,
    position,
    isActive: row.is_active,
  };
}

function mapHomeSectionRow(row: HomeSectionRow): AdminHomeSectionDraft {
  const displayOrder = toNumber(row.display_order);
  const limitCount = toNumber(row.limit_count);
  const sliceOffset = toNumber(row.slice_offset);

  if (
    typeof row.slug !== "string" ||
    typeof row.title !== "string" ||
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
    description: toString(row.description),
    displayOrder,
    isActive: row.is_active,
    mode: row.mode,
    limitCount,
    ctaEnabled: row.cta_enabled,
    ctaLabel: toNullableString(row.cta_label) ?? "",
    ctaHref: toNullableString(row.cta_href) ?? "",
    fallbackMode: row.fallback_mode,
    sliceOffset,
    items: row.home_section_items.map((item) =>
      mapHomeSectionItemRow(item as HomeSectionItemRow),
    ),
  };
}

function readString(
  source: Record<string, unknown>,
  field: string,
  label: string,
  errors: string[],
): string {
  const value = source[field];

  if (typeof value !== "string") {
    errors.push(`${label} ${field} must be a string.`);
    return "";
  }

  return value;
}

function readBoolean(
  source: Record<string, unknown>,
  field: string,
  label: string,
  errors: string[],
): boolean {
  const value = source[field];

  if (typeof value !== "boolean") {
    errors.push(`${label} ${field} must be a boolean.`);
    return false;
  }

  return value;
}

function readNumber(
  source: Record<string, unknown>,
  field: string,
  label: string,
  errors: string[],
): number {
  const value = source[field];

  if (typeof value !== "number") {
    errors.push(`${label} ${field} must be a number.`);
    return 0;
  }

  return value;
}

function validateOptionalPrimitiveFields(
  source: Record<string, unknown>,
  fields: Record<string, "boolean" | "number">,
  label: string,
  errors: string[],
) {
  Object.entries(fields).forEach(([field, type]) => {
    if (source[field] !== undefined && typeof source[field] !== type) {
      errors.push(`${label} ${field} must be a ${type}.`);
    }
  });
}

function parseSectionsPayload(payload: unknown): ParsedSectionsPayload {
  const errors: string[] = [];

  if (!isRecord(payload)) {
    return {
      sections: [],
      errors: ["Body must be an object."],
    };
  }

  if (!Array.isArray(payload.sections)) {
    return {
      sections: [],
      errors: ["sections must be an array."],
    };
  }

  if (payload.sections.length === 0) {
    return {
      sections: [],
      errors: ["At least one section is required."],
    };
  }

  const sections = payload.sections.map((section, sectionIndex) => {
    const sectionLabel = `Section ${sectionIndex + 1}`;

    if (!isRecord(section)) {
      errors.push(`${sectionLabel} must be an object.`);

      return {
        slug: "",
        title: "",
        description: "",
        mode: "manual",
        limitCount: 0,
        fallbackMode: "none",
        sliceOffset: 0,
        isActive: false,
        ctaEnabled: false,
        ctaLabel: "",
        ctaHref: "",
        items: [],
      } satisfies HomeSectionDraft;
    }

    validateOptionalPrimitiveFields(
      section,
      { displayOrder: "number" },
      sectionLabel,
      errors,
    );

    const items = Array.isArray(section.items)
      ? section.items.map((item, itemIndex) => {
          const itemLabel = `${sectionLabel} item ${itemIndex + 1}`;

          if (!isRecord(item)) {
            errors.push(`${itemLabel} must be an object.`);

            return { houseId: "", isActive: true };
          }

          validateOptionalPrimitiveFields(
            item,
            {
              position: "number",
              isActive: "boolean",
            },
            itemLabel,
            errors,
          );

          return {
            houseId: readString(item, "houseId", itemLabel, errors),
            isActive: typeof item.isActive === "boolean" ? item.isActive : true,
          };
        })
      : [];

    if (!Array.isArray(section.items)) {
      errors.push(`${sectionLabel} items must be an array.`);
    }

    return {
      slug: readString(section, "slug", sectionLabel, errors),
      title: readString(section, "title", sectionLabel, errors),
      description: readString(section, "description", sectionLabel, errors),
      mode: readString(section, "mode", sectionLabel, errors) as HomeSectionMode,
      limitCount: readNumber(section, "limitCount", sectionLabel, errors),
      fallbackMode: readString(
        section,
        "fallbackMode",
        sectionLabel,
        errors,
      ) as HomeSectionFallbackMode,
      sliceOffset: readNumber(section, "sliceOffset", sectionLabel, errors),
      isActive: readBoolean(section, "isActive", sectionLabel, errors),
      ctaEnabled: readBoolean(section, "ctaEnabled", sectionLabel, errors),
      ctaLabel: readString(section, "ctaLabel", sectionLabel, errors),
      ctaHref: readString(section, "ctaHref", sectionLabel, errors),
      items,
    } satisfies HomeSectionDraft;
  });

  if (errors.length > 0) {
    return { sections: [], errors };
  }

  return { sections, errors: [] };
}

function toRpcPayload(sections: HomeSectionSavePayload[]): RpcHomeSectionPayload[] {
  return sections.map((section) => ({
    slug: section.slug,
    title: section.title,
    description: section.description,
    mode: section.mode,
    fallback_mode: section.fallbackMode,
    slice_offset: section.sliceOffset,
    is_active: section.isActive,
    limit_count: section.limitCount,
    display_order: section.display_order,
    cta_enabled: section.ctaLabel !== null && section.ctaHref !== null,
    cta_label: section.ctaLabel,
    cta_href: section.ctaHref,
    items: section.items.map((item) => ({
      house_id: item.houseId,
      position: item.position,
      is_active: item.isActive,
    })),
  }));
}

function mapSavedHomeSectionPayload(
  section: RpcHomeSectionPayload,
): AdminHomeSectionDraft {
  return {
    slug: section.slug,
    title: section.title,
    description: section.description,
    displayOrder: section.display_order,
    isActive: section.is_active,
    mode: section.mode,
    limitCount: section.limit_count,
    ctaEnabled: section.cta_enabled,
    ctaLabel: section.cta_label ?? "",
    ctaHref: section.cta_href ?? "",
    fallbackMode: section.fallback_mode,
    sliceOffset: section.slice_offset,
    items: section.items.map((item) => ({
      houseId: item.house_id,
      position: item.position,
      isActive: item.is_active,
    })),
  };
}

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const supabase = admin.supabase;

  const { data, error } = await supabase
    .from("home_sections")
    .select(
      "slug,title,description,display_order,is_active,mode,limit_count,cta_enabled,cta_label,cta_href,fallback_mode,slice_offset,home_section_items(house_id,position,is_active)",
    )
    .order("display_order", { ascending: true })
    .order("position", {
      ascending: true,
      referencedTable: "home_section_items",
    });

  if (error || !Array.isArray(data)) {
    return adminSupabaseErrorResponse(error, "Unable to load home sections.");
  }

  try {
    return Response.json({
      sections: (data as HomeSectionRow[]).map(mapHomeSectionRow),
    });
  } catch (error) {
    return jsonError("Invalid home section data.", 500, {
      details:
        error instanceof Error ? error.message : "Unable to map home section row.",
    });
  }
}

export async function PUT(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const supabase = admin.supabase;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ errors: ["Request body must be JSON."] }, { status: 400 });
  }

  const parsedPayload = parseSectionsPayload(payload);

  if (parsedPayload.errors.length > 0) {
    return Response.json({ errors: parsedPayload.errors }, { status: 400 });
  }

  const sections = parsedPayload.sections;
  const errors = validateHomeSectionDrafts(sections);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const normalizedSections = normalizeHomeSectionDraftsForSave(sections);
  const rpcPayload = toRpcPayload(normalizedSections);
  const { error } = await supabase.rpc("save_home_section_snapshot", {
    snapshot: rpcPayload,
  });

  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to save home sections.");
  }

  revalidateHomeSectionsCache();

  return Response.json({
    sections: rpcPayload.map(mapSavedHomeSectionPayload),
  });
}
