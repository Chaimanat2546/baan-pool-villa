import {
  adminSupabaseErrorResponse,
  type HomeConfigSupabaseClient,
  type SupabaseLikeError,
} from "@/lib/admin/route-helpers";
import {
  revalidateSiteSeoSettingsCache,
  revalidateSiteSettingsCache,
} from "@/lib/cache-revalidation";
import {
  buildSiteSeoRows,
  mapSiteSeoRowsToLegacyProjection,
  SITE_SEO_PAGE_TYPES,
  type SiteSeoSettingsRow,
} from "@/lib/site-seo-settings/rows";

import {
  cleanupFailedSiteAssetSave,
  cleanupRetainedAssets,
  markPreviousUploadsInactive,
  recordUploadedAssets,
  uploadSiteSettingsAssets,
} from "./admin-asset-uploads";
import {
  buildSiteSettingsSectionPayload,
  getSectionUploadFiles,
  getSiteSettingsSectionSelects,
  isSiteSettingsSection,
  mapSiteSettingsSectionResponse,
  parseSiteSettingsSectionRequest,
  type SiteSettingsSection,
} from "./admin-section-contracts";
import { SITE_SETTINGS_ID } from "./defaults";
import type { SiteAssetType, SiteSettingsRow } from "./types";
import { normalizeSiteSettingsRow } from "./validation";

const ASSET_PERSISTENCE_COLUMNS: Record<SiteAssetType, readonly string[]> = {
  favicon: ["favicon_image_path", "favicon_image_url"],
  logo: ["logo_image_path", "logo_image_url"],
  hero: ["hero_image_path", "hero_image_url"],
  "seo-og": ["seo_og_image_url"],
  "search-seo-og": ["search_seo_og_image_url"],
  "guides-seo-og": ["guides_seo_og_image_url"],
};
const SITE_SEO_PAGE_TYPE_SET = new Set<string>(SITE_SEO_PAGE_TYPES);

function incompleteSiteSeoRowsError(): SupabaseLikeError {
  return {
    code: "SITE_SEO_SETTINGS_INCOMPLETE",
    details: `Expected exactly one usable row for each page type: ${SITE_SEO_PAGE_TYPES.join(", ")}.`,
    message: "SEO settings rows are incomplete.",
  };
}

function getCompleteSiteSeoRows(data: unknown): SiteSeoSettingsRow[] | null {
  if (!Array.isArray(data) || data.length !== SITE_SEO_PAGE_TYPES.length) {
    return null;
  }

  const pageTypes = new Set<string>();

  for (const row of data) {
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      return null;
    }

    const { page_type: pageType, settings } = row as Record<string, unknown>;
    if (
      typeof pageType !== "string" ||
      !SITE_SEO_PAGE_TYPE_SET.has(pageType) ||
      pageTypes.has(pageType) ||
      settings === null ||
      typeof settings !== "object" ||
      Array.isArray(settings)
    ) {
      return null;
    }
    pageTypes.add(pageType);
  }

  return data as SiteSeoSettingsRow[];
}

function unknownSectionResponse() {
  return Response.json({ error: "Unknown settings section." }, { status: 404 });
}

function isMissingColumnError(error: SupabaseLikeError | null | undefined) {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42703" ||
    (message.includes("column") && message.includes("does not exist")) ||
    message.includes("schema cache") ||
    message.includes("unknown column")
  );
}

async function loadSection(
  section: SiteSettingsSection,
  supabase: HomeConfigSupabaseClient,
): Promise<{
  data: SiteSettingsRow | null;
  error: SupabaseLikeError | null;
  availableColumns: ReadonlySet<string>;
}> {
  if (section === "seo") {
    const result = await supabase
      .from("site_seo_settings")
      .select("page_type,settings");

    if (result.error) {
      return { data: null, error: result.error, availableColumns: new Set() };
    }

    const rows = getCompleteSiteSeoRows(result.data);
    if (!rows) {
      return {
        data: null,
        error: incompleteSiteSeoRowsError(),
        availableColumns: new Set(),
      };
    }

    return {
      data: {
        id: SITE_SETTINGS_ID,
        ...mapSiteSeoRowsToLegacyProjection(rows),
      } as SiteSettingsRow,
      error: null,
      availableColumns: new Set(
        getSiteSettingsSectionSelects("seo")[0].split(","),
      ),
    };
  }

  let lastError: SupabaseLikeError | null = null;

  for (const select of getSiteSettingsSectionSelects(section)) {
    const result = await supabase
      .from("site_settings")
      .select(select)
      .eq("id", SITE_SETTINGS_ID)
      .maybeSingle();

    if (!result.error) {
      return {
        data: (result.data as SiteSettingsRow | null) ?? null,
        error: null,
        availableColumns: new Set(select.split(",")),
      };
    }
    if (!isMissingColumnError(result.error)) {
      return { data: null, error: result.error, availableColumns: new Set() };
    }
    lastError = result.error;
  }

  return { data: null, error: lastError, availableColumns: new Set() };
}

export async function buildAdminSiteSettingsSectionResponse(
  section: string,
  supabase: HomeConfigSupabaseClient,
) {
  if (!isSiteSettingsSection(section)) return unknownSectionResponse();

  const { data, error } = await loadSection(section, supabase);
  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to load site settings.");
  }

  const settings = normalizeSiteSettingsRow(data);
  return Response.json({ section, settings: mapSiteSettingsSectionResponse(section, settings) });
}

async function readRequestBody(request: Request, section: SiteSettingsSection) {
  try {
    return section === "theme" || section === "contact"
      ? await request.json() as Record<string, unknown>
      : await request.formData();
  } catch {
    return null;
  }
}

export async function saveAdminSiteSettingsSection(
  request: Request,
  section: string,
  supabase: HomeConfigSupabaseClient,
) {
  if (!isSiteSettingsSection(section)) return unknownSectionResponse();

  const body = await readRequestBody(request, section);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ errors: ["Invalid request body."] }, { status: 400 });
  }

  const draftResult = parseSiteSettingsSectionRequest(section, body);
  if (!draftResult.ok) {
    return Response.json({ errors: draftResult.errors }, { status: 400 });
  }

  const uploadResult = body instanceof FormData
    ? getSectionUploadFiles(section, body)
    : { errors: [], uploadFiles: [] };
  if (uploadResult.errors.length > 0) {
    return Response.json({ errors: uploadResult.errors }, { status: 400 });
  }

  const {
    data: existingRow,
    error: loadError,
    availableColumns,
  } = await loadSection(section, supabase);
  if (loadError) {
    return adminSupabaseErrorResponse(loadError, "Unable to load site settings.");
  }
  if (!existingRow) {
    return Response.json({ error: "Site settings were not found." }, { status: 404 });
  }
  const unsupportedUploads = uploadResult.uploadFiles.filter(({ assetType }) =>
    ASSET_PERSISTENCE_COLUMNS[assetType].some(
      (column) => !availableColumns.has(column),
    ),
  );
  if (unsupportedUploads.length > 0) {
    return Response.json({
      errors: unsupportedUploads.map(
        ({ assetType }) => `The current settings schema cannot save the ${assetType} image.`,
      ),
    }, { status: 400 });
  }
  const currentSettings = normalizeSiteSettingsRow(existingRow);

  const uploaded = await uploadSiteSettingsAssets(supabase, uploadResult.uploadFiles);
  if (!uploaded.ok) {
    return adminSupabaseErrorResponse(
      uploaded.error,
      `Unable to upload ${uploaded.assetType} image.`,
      { warning: uploaded.cleanupWarnings.join("; ") || undefined },
    );
  }

  const history = await recordUploadedAssets(supabase, uploaded.uploadedAssets);
  if (!history.ok) {
    const cleanupWarnings = await cleanupFailedSiteAssetSave(
      supabase,
      history.recordedAssets,
      uploaded.uploadedAssets,
    );
    return adminSupabaseErrorResponse(
      history.error,
      "Unable to record site asset upload history.",
      { warning: cleanupWarnings.join("; ") || undefined },
    );
  }

  const payload = Object.fromEntries(Object.entries(buildSiteSettingsSectionPayload(
    section,
    draftResult.draft,
    currentSettings,
    uploaded.uploadedAssets,
  )).filter(([column]) => availableColumns.has(column)));
  let saveError: SupabaseLikeError | null;
  let updatedRow: unknown = true;

  if (section === "seo") {
    const result = await supabase
      .from("site_seo_settings")
      .upsert(buildSiteSeoRows(payload), { onConflict: "page_type" })
      .select("page_type,settings");
    saveError = result.error;
  } else {
    const result = await supabase
      .from("site_settings")
      .update(payload)
      .eq("id", SITE_SETTINGS_ID)
      .select("id")
      .maybeSingle();
    saveError = result.error;
    updatedRow = result.data;
  }

  if (saveError || !updatedRow) {
    const cleanupWarnings = await cleanupFailedSiteAssetSave(
      supabase,
      history.recordedAssets,
      uploaded.uploadedAssets,
    );
    return adminSupabaseErrorResponse(saveError ?? {
      code: "PGRST116",
      message: "Site settings were not found.",
    }, "Unable to save site settings.", {
      warning: cleanupWarnings.join("; ") || undefined,
    });
  }

  const { data: savedRow, error: reloadError } = await loadSection(section, supabase);
  const verified = !reloadError && savedRow !== null;
  const shouldFinalizeAssets = section !== "seo" || verified;
  const historyUpdateError = shouldFinalizeAssets
    ? await markPreviousUploadsInactive(supabase, history.recordedAssets)
    : null;
  if (historyUpdateError) {
    console.error("Unable to mark previous site asset uploads inactive", historyUpdateError);
  }

  const warnings = [
    ...(historyUpdateError
      ? ["Unable to mark previous site asset uploads inactive."]
      : []),
    ...(shouldFinalizeAssets && uploaded.uploadedAssets.length > 0
      ? await cleanupRetainedAssets(supabase)
      : []),
  ];
  const responseRow = savedRow ?? ({ ...existingRow, ...payload } as SiteSettingsRow);
  if (!verified) {
    warnings.push("Settings were saved but could not be reloaded.");
  }

  try {
    await (section === "seo"
      ? revalidateSiteSeoSettingsCache()
      : revalidateSiteSettingsCache());
  } catch {
    warnings.push("Settings were saved but cache refresh failed.");
  }
  const settings = normalizeSiteSettingsRow(responseRow);
  return Response.json({
    section,
    settings: mapSiteSettingsSectionResponse(section, settings),
    verified,
    warnings: [...new Set(warnings)],
  });
}
