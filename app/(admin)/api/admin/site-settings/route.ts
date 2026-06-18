import {
  adminSupabaseErrorResponse,
  requireHomeConfigAdmin,
} from "@/lib/admin/route-helpers";
import { revalidateSiteSettingsCache } from "@/lib/cache-revalidation";
import {
  cleanupFailedSiteAssetSave,
  cleanupRetainedAssets,
  markPreviousUploadsInactive,
  recordUploadedAssets,
  uploadSiteSettingsAssets,
} from "@/lib/site-settings/admin-asset-uploads";
import type { UploadedAsset } from "@/lib/site-settings/admin-asset-uploads";
import {
  buildAdminSiteSettingsResponse,
  buildSavedSettingsRow,
  buildSiteSettingsSavePayload,
  loadAdminSiteSettings,
  readSiteSettingsDraft,
  readSiteSettingsUploadFiles,
} from "@/lib/site-settings/admin-route";
import type { SiteSettingsRow } from "@/lib/site-settings/types";
import {
  normalizeSiteSettingsRow,
  validateSiteSettingsDraft,
} from "@/lib/site-settings/validation";

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return buildAdminSiteSettingsResponse(admin.supabase);
}

export async function PUT(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { errors: ["Request body must be multipart/form-data."] },
      { status: 400 },
    );
  }

  const draftResult = readSiteSettingsDraft(formData);

  if (!draftResult.ok) {
    return draftResult.response;
  }

  const draft = draftResult.draft;
  const errors = validateSiteSettingsDraft(draft);
  const uploadResult = readSiteSettingsUploadFiles(formData);

  errors.push(...uploadResult.errors);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const { data: existingRow, error: loadError } = await loadAdminSiteSettings(
    admin.supabase,
  );

  if (loadError) {
    return adminSupabaseErrorResponse(loadError, "Unable to load site settings.");
  }

  const currentSettings = normalizeSiteSettingsRow(
    (existingRow as SiteSettingsRow | null) ?? null,
  );
  const uploadAssetsResult = await uploadSiteSettingsAssets(
    admin.supabase,
    uploadResult.uploadFiles,
  );

  if (!uploadAssetsResult.ok) {
    return adminSupabaseErrorResponse(
      uploadAssetsResult.error,
      `Unable to upload ${uploadAssetsResult.assetType} image.`,
      { warning: uploadAssetsResult.cleanupWarnings.join("; ") || undefined },
    );
  }

  const uploadedAssets: UploadedAsset[] = uploadAssetsResult.uploadedAssets;
  const historyResult = await recordUploadedAssets(admin.supabase, uploadedAssets);

  if (!historyResult.ok) {
    const cleanupWarnings = await cleanupFailedSiteAssetSave(
      admin.supabase,
      historyResult.recordedAssets,
      uploadedAssets,
    );

    return adminSupabaseErrorResponse(
      historyResult.error,
      "Unable to record site asset upload history.",
      { warning: cleanupWarnings.join("; ") || undefined },
    );
  }

  const savePayload = buildSiteSettingsSavePayload({
    currentSettings,
    draft,
    uploadedAssets,
  });

  const { error: saveError } = await admin.supabase
    .from("site_settings")
    .upsert(savePayload, { onConflict: "id" });

  if (saveError) {
    const cleanupWarnings = await cleanupFailedSiteAssetSave(
      admin.supabase,
      historyResult.recordedAssets,
      uploadedAssets,
    );

    return adminSupabaseErrorResponse(
      saveError,
      "Unable to save site settings.",
      { warning: cleanupWarnings.join("; ") || undefined },
    );
  }

  const historyUpdateError = await markPreviousUploadsInactive(
    admin.supabase,
    historyResult.recordedAssets,
  );

  if (historyUpdateError) {
    return adminSupabaseErrorResponse(
      historyUpdateError,
      "Unable to mark previous site asset uploads inactive.",
    );
  }

  const warnings = [
    ...(uploadedAssets.length > 0
      ? await cleanupRetainedAssets(admin.supabase)
      : []),
  ];
  const { data: savedRow, error: reloadError } = await loadAdminSiteSettings(
    admin.supabase,
  );
  const responseRow = reloadError
    ? buildSavedSettingsRow((existingRow as SiteSettingsRow | null) ?? null, savePayload)
    : ((savedRow as SiteSettingsRow | null) ??
      buildSavedSettingsRow((existingRow as SiteSettingsRow | null) ?? null, savePayload));

  if (reloadError) {
    warnings.push(reloadError.message ?? "Unable to reload saved site settings.");
  }

  await revalidateSiteSettingsCache();

  return Response.json({
    settings: normalizeSiteSettingsRow(responseRow),
    warnings,
  });
}
