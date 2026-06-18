import {
  adminSupabaseErrorResponse,
  requireHomeConfigAdmin,
} from "@/lib/admin/route-helpers";
import { revalidateSiteSettingsCache } from "@/lib/cache-revalidation";
import {
  cleanupRetainedAssets,
  deleteRecordedAssets,
  markPreviousUploadsInactive,
  recordUploadedAssets,
  removeUploadedAssets,
  uploadAsset,
} from "@/lib/site-settings/admin-asset-uploads";
import type { UploadedAsset } from "@/lib/site-settings/admin-asset-uploads";
import {
  getOptionalUpload,
  readPhoneContactsField,
  readStringArrayField,
  readStringField,
} from "@/lib/site-settings/admin-form-fields";
import {
  ASSET_UPLOAD_FIELDS,
  buildSavedSettingsRow,
  loadAdminSiteSettings,
} from "@/lib/site-settings/admin-route";
import { SITE_SETTINGS_ID } from "@/lib/site-settings/defaults";
import type {
  SiteAssetType,
  SiteSettingsRow,
} from "@/lib/site-settings/types";
import {
  normalizeSiteSettingsDraft,
  normalizeSiteSettingsRow,
  validateSiteSettingsDraft,
  validateUploadMetadata,
} from "@/lib/site-settings/validation";

/**
 * Handle GET requests to return the current admin-visible site settings.
 *
 * Performs admin authorization and, if authorized, returns a JSON response
 * containing the normalized site settings. On authorization failure or data
 * loading errors, returns an appropriate JSON error response.
 *
 * @returns A Response whose body is JSON `{ settings: <normalized site settings or null> }` on success, or a JSON error response on failure.
 */
export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const { data, error } = await loadAdminSiteSettings(admin.supabase);

  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to load site settings.");
  }

  return Response.json({
    settings: normalizeSiteSettingsRow((data as SiteSettingsRow | null) ?? null),
  });
}

/**
 * Handle an admin-authenticated multipart PUT request to validate and persist site settings, optionally upload logo and hero images, record upload history, clean up retained assets, and revalidate the site settings cache.
 *
 * @returns On success, an object with `settings` containing the saved site settings and `warnings` as an array of cleanup warnings (may be empty). On failure, an error response describing authorization, validation, upload, or persistence failures.
 */
export async function PUT(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json({ errors: ["Request body must be multipart/form-data."] }, { status: 400 });
  }

  const phoneContactsResult = readPhoneContactsField(formData);

  if (!phoneContactsResult.ok) {
    return Response.json({ errors: [phoneContactsResult.error] }, { status: 400 });
  }

  const draft = normalizeSiteSettingsDraft({
    siteName: readStringField(formData, "siteName"),
    primaryColor: readStringField(formData, "primaryColor"),
    accentColor: readStringField(formData, "accentColor"),
    heroImageAlt: readStringField(formData, "heroImageAlt"),
    bankAccountName: readStringField(formData, "bankAccountName"),
    bankName: readStringField(formData, "bankName"),
    bankAccountNumber: readStringField(formData, "bankAccountNumber"),
    phoneContacts: phoneContactsResult.value,
    messengerUrl: readStringField(formData, "messengerUrl"),
    lineId: readStringField(formData, "lineId"),
    lineUrl: readStringField(formData, "lineUrl"),
    seoTitle: readStringField(formData, "seoTitle"),
    seoDescription: readStringField(formData, "seoDescription"),
    seoKeywords: readStringArrayField(formData, "seoKeywords"),
    seoOgImageUrl: readStringField(formData, "seoOgImageUrl"),
    seoOgImageAlt: readStringField(formData, "seoOgImageAlt"),
    seoBusinessName: readStringField(formData, "seoBusinessName"),
    seoSameAsUrls: readStringArrayField(formData, "seoSameAsUrls"),
    searchSeoTitle: readStringField(formData, "searchSeoTitle"),
    searchSeoDescription: readStringField(formData, "searchSeoDescription"),
    searchSeoKeywords: readStringArrayField(formData, "searchSeoKeywords"),
    searchSeoOgImageUrl: readStringField(formData, "searchSeoOgImageUrl"),
    searchSeoOgImageAlt: readStringField(formData, "searchSeoOgImageAlt"),
    guidesSeoTitle: readStringField(formData, "guidesSeoTitle"),
    guidesSeoDescription: readStringField(formData, "guidesSeoDescription"),
    guidesSeoKeywords: readStringArrayField(formData, "guidesSeoKeywords"),
    guidesSeoOgImageUrl: readStringField(formData, "guidesSeoOgImageUrl"),
    guidesSeoOgImageAlt: readStringField(formData, "guidesSeoOgImageAlt"),
    villaDetailSeoKeywords: readStringArrayField(formData, "villaDetailSeoKeywords"),
    tiktokAccountUrl: "",
    tiktokVideoUrls: [],
  });
  const errors = validateSiteSettingsDraft(draft);
  const uploadFiles: { assetType: SiteAssetType; file: File }[] = [];

  ASSET_UPLOAD_FIELDS.forEach(({ assetType, fieldName }) => {
    const file = getOptionalUpload(formData, fieldName);

    if (!file) {
      return;
    }

    errors.push(...validateUploadMetadata(assetType, file.type, file.size));
    uploadFiles.push({ assetType, file });
  });

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
  const uploadedAssets: UploadedAsset[] = [];

  for (const upload of uploadFiles) {
    const result = await uploadAsset(admin.supabase, upload.assetType, upload.file);

    if (result.error || !result.asset) {
      const cleanupWarnings = await removeUploadedAssets(admin.supabase, uploadedAssets);

      return adminSupabaseErrorResponse(
        result.error,
        `Unable to upload ${upload.assetType} image.`,
        { warning: cleanupWarnings.join("; ") || undefined },
      );
    }

    uploadedAssets.push(result.asset);
  }

  const logoUpload = uploadedAssets.find((asset) => asset.assetType === "logo");
  const heroUpload = uploadedAssets.find((asset) => asset.assetType === "hero");
  const historyResult = await recordUploadedAssets(admin.supabase, uploadedAssets);

  if (!historyResult.ok) {
    const cleanupWarnings = [
      ...(await deleteRecordedAssets(admin.supabase, historyResult.recordedAssets)),
      ...(await removeUploadedAssets(admin.supabase, uploadedAssets)),
    ];

    return adminSupabaseErrorResponse(
      historyResult.error,
      "Unable to record site asset upload history.",
      { warning: cleanupWarnings.join("; ") || undefined },
    );
  }

  const savePayload = {
    id: SITE_SETTINGS_ID,
    site_name: draft.siteName,
    primary_color: draft.primaryColor,
    accent_color: draft.accentColor,
    logo_image_path: logoUpload?.path ?? currentSettings.logoImage.path,
    logo_image_url: logoUpload?.publicUrl ?? currentSettings.logoImage.url,
    hero_image_path: heroUpload?.path ?? currentSettings.heroImage.path,
    hero_image_url: heroUpload?.publicUrl ?? currentSettings.heroImage.url,
    hero_image_alt: draft.heroImageAlt,
    bank_account_name: draft.bankAccountName,
    bank_name: draft.bankName,
    bank_account_number: draft.bankAccountNumber,
    phone_contacts: draft.phoneContacts,
    messenger_url: draft.messengerUrl,
    line_id: draft.lineId,
    line_url: draft.lineUrl,
    seo_title: draft.seoTitle,
    seo_description: draft.seoDescription,
    seo_keywords: draft.seoKeywords,
    seo_og_image_url: draft.seoOgImageUrl,
    seo_og_image_alt: draft.seoOgImageAlt,
    seo_business_name: draft.seoBusinessName,
    seo_same_as_urls: draft.seoSameAsUrls,
    search_seo_title: draft.searchSeoTitle,
    search_seo_description: draft.searchSeoDescription,
    search_seo_keywords: draft.searchSeoKeywords,
    search_seo_og_image_url: draft.searchSeoOgImageUrl,
    search_seo_og_image_alt: draft.searchSeoOgImageAlt,
    guides_seo_title: draft.guidesSeoTitle,
    guides_seo_description: draft.guidesSeoDescription,
    guides_seo_keywords: draft.guidesSeoKeywords,
    guides_seo_og_image_url: draft.guidesSeoOgImageUrl,
    guides_seo_og_image_alt: draft.guidesSeoOgImageAlt,
    villa_detail_seo_keywords: draft.villaDetailSeoKeywords,
  };

  const { error: saveError } = await admin.supabase
    .from("site_settings")
    .upsert(savePayload, { onConflict: "id" });

  if (saveError) {
    const cleanupWarnings = [
      ...(await deleteRecordedAssets(admin.supabase, historyResult.recordedAssets)),
      ...(await removeUploadedAssets(admin.supabase, uploadedAssets)),
    ];

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
