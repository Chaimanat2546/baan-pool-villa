import {
  adminSupabaseErrorResponse,
  type HomeConfigSupabaseClient,
  type SupabaseLikeError,
} from "@/lib/admin/route-helpers";
import { revalidateSiteSettingsCache } from "@/lib/cache-revalidation";

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
import type { SiteSettingsRow } from "./types";
import { normalizeSiteSettingsRow } from "./validation";

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
): Promise<{ data: SiteSettingsRow | null; error: SupabaseLikeError | null }> {
  let lastError: SupabaseLikeError | null = null;

  for (const select of getSiteSettingsSectionSelects(section)) {
    const result = await supabase
      .from("site_settings")
      .select(select)
      .eq("id", SITE_SETTINGS_ID)
      .maybeSingle();

    if (!result.error) {
      return { data: (result.data as SiteSettingsRow | null) ?? null, error: null };
    }
    if (!isMissingColumnError(result.error)) {
      return { data: null, error: result.error };
    }
    lastError = result.error;
  }

  return { data: null, error: lastError };
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
  return Response.json({
    section,
    settings: mapSiteSettingsSectionResponse(section, settings),
  });
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

  const { data: existingRow, error: loadError } = await loadSection(section, supabase);
  if (loadError) {
    return adminSupabaseErrorResponse(loadError, "Unable to load site settings.");
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

  const payload = buildSiteSettingsSectionPayload(
    section,
    draftResult.draft,
    currentSettings,
    uploaded.uploadedAssets,
  );
  const { error: saveError } = await supabase
    .from("site_settings")
    .update(payload)
    .eq("id", SITE_SETTINGS_ID);

  if (saveError) {
    const cleanupWarnings = await cleanupFailedSiteAssetSave(
      supabase,
      history.recordedAssets,
      uploaded.uploadedAssets,
    );
    return adminSupabaseErrorResponse(saveError, "Unable to save site settings.", {
      warning: cleanupWarnings.join("; ") || undefined,
    });
  }

  const historyUpdateError = await markPreviousUploadsInactive(
    supabase,
    history.recordedAssets,
  );
  if (historyUpdateError) {
    console.error("Unable to mark previous site asset uploads inactive", historyUpdateError);
  }

  const warnings = [
    ...(historyUpdateError
      ? ["Unable to mark previous site asset uploads inactive."]
      : []),
    ...(uploaded.uploadedAssets.length > 0
      ? await cleanupRetainedAssets(supabase)
      : []),
  ];
  const { data: savedRow, error: reloadError } = await loadSection(section, supabase);
  const responseRow = savedRow ?? ({ ...(existingRow ?? {}), ...payload } as SiteSettingsRow);
  if (reloadError) {
    warnings.push(reloadError.message ?? "Unable to reload saved site settings.");
  }

  await revalidateSiteSettingsCache();
  const settings = normalizeSiteSettingsRow(responseRow);
  return Response.json({
    section,
    settings: mapSiteSettingsSectionResponse(section, settings),
    warnings: [...new Set(warnings)],
  });
}
