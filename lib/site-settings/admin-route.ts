import {
  adminSupabaseErrorResponse,
  type HomeConfigSupabaseClient,
  type SupabaseLikeError,
} from "@/lib/admin/route-helpers";
import { revalidateSiteSettingsCache } from "@/lib/cache-revalidation";
import {
  readPhoneContactsField,
  readStringArrayField,
  readStringField,
} from "@/lib/site-settings/admin-form-fields";
import {
  normalizeSiteSettingsDraft,
  normalizeSiteSettingsRow,
  validateSiteSettingsDraft,
} from "@/lib/site-settings/validation";
import {
  cleanupFailedSiteAssetSave,
  cleanupRetainedAssets,
  markPreviousUploadsInactive,
  readSiteSettingsUploadFiles,
  recordUploadedAssets,
  uploadSiteSettingsAssets,
} from "./admin-asset-uploads";
import { SITE_SETTINGS_ID } from "./defaults";
import type { UploadedAsset } from "./admin-asset-uploads";
import type {
  SiteSettings,
  SiteSettingsDraft,
  SiteSettingsRow,
} from "./types";

const SITE_SETTINGS_SELECT =
  "id,site_name,primary_color,accent_color,header_link_color,header_link_hover_color,footer_link_color,footer_link_hover_color,bank_highlight_color,bank_account_highlight_color,bank_name_highlight_color,bank_number_highlight_color,logo_background,villa_card_style,logo_image_path,logo_image_url,favicon_image_path,favicon_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_keywords,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,search_seo_title,search_seo_description,search_seo_keywords,search_seo_og_image_url,search_seo_og_image_alt,guides_seo_title,guides_seo_description,guides_seo_keywords,guides_seo_og_image_url,guides_seo_og_image_alt,villa_detail_seo_keywords,detail_layout,tiktok_account_url,tiktok_video_urls,google_tag_manager_id";
const SITE_SETTINGS_SELECT_WITHOUT_MARKETING_TAGS =
  "id,site_name,primary_color,accent_color,header_link_color,header_link_hover_color,footer_link_color,footer_link_hover_color,bank_highlight_color,bank_account_highlight_color,bank_name_highlight_color,bank_number_highlight_color,logo_background,villa_card_style,logo_image_path,logo_image_url,favicon_image_path,favicon_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_keywords,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,search_seo_title,search_seo_description,search_seo_keywords,search_seo_og_image_url,search_seo_og_image_alt,guides_seo_title,guides_seo_description,guides_seo_keywords,guides_seo_og_image_url,guides_seo_og_image_alt,villa_detail_seo_keywords,detail_layout,tiktok_account_url,tiktok_video_urls";
const SITE_SETTINGS_SELECT_WITHOUT_KEYWORDS =
  "id,site_name,primary_color,accent_color,header_link_color,header_link_hover_color,footer_link_color,footer_link_hover_color,bank_highlight_color,bank_account_highlight_color,bank_name_highlight_color,bank_number_highlight_color,logo_background,villa_card_style,logo_image_path,logo_image_url,favicon_image_path,favicon_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,search_seo_title,search_seo_description,search_seo_og_image_url,search_seo_og_image_alt,guides_seo_title,guides_seo_description,guides_seo_og_image_url,guides_seo_og_image_alt,detail_layout,tiktok_account_url,tiktok_video_urls";
const SITE_SETTINGS_SELECT_WITHOUT_PAGE_SEO =
  "id,site_name,primary_color,accent_color,header_link_color,header_link_hover_color,footer_link_color,footer_link_hover_color,bank_highlight_color,bank_account_highlight_color,bank_name_highlight_color,bank_number_highlight_color,logo_background,villa_card_style,logo_image_path,logo_image_url,favicon_image_path,favicon_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,detail_layout,tiktok_account_url,tiktok_video_urls";
const SITE_SETTINGS_SELECT_WITHOUT_TIKTOK =
  "id,site_name,primary_color,accent_color,header_link_color,header_link_hover_color,footer_link_color,footer_link_hover_color,bank_highlight_color,bank_account_highlight_color,bank_name_highlight_color,bank_number_highlight_color,logo_background,villa_card_style,logo_image_path,logo_image_url,favicon_image_path,favicon_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,detail_layout";
const SITE_SETTINGS_GENERAL_SELECT =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls";
const SITE_SETTINGS_SELECTS: readonly string[] = [
  SITE_SETTINGS_SELECT,
  SITE_SETTINGS_SELECT_WITHOUT_MARKETING_TAGS,
  SITE_SETTINGS_SELECT_WITHOUT_KEYWORDS,
  SITE_SETTINGS_SELECT_WITHOUT_PAGE_SEO,
  SITE_SETTINGS_SELECT_WITHOUT_TIKTOK,
  SITE_SETTINGS_GENERAL_SELECT,
];

export function readSiteSettingsDraft(formData: FormData):
  | { draft: SiteSettingsDraft; ok: true }
  | { ok: false; response: Response } {
  const phoneContactsResult = readPhoneContactsField(formData);

  if (!phoneContactsResult.ok) {
    return {
      ok: false,
      response: Response.json(
        { errors: [phoneContactsResult.error] },
        { status: 400 },
      ),
    };
  }

  return {
    draft: normalizeSiteSettingsDraft({
      siteName: readStringField(formData, "siteName"),
      primaryColor: readStringField(formData, "primaryColor"),
      accentColor: readStringField(formData, "accentColor"),
      headerLinkColor: readStringField(formData, "headerLinkColor"),
      headerLinkHoverColor: readStringField(formData, "headerLinkHoverColor"),
      footerLinkColor: readStringField(formData, "footerLinkColor"),
      footerLinkHoverColor: readStringField(formData, "footerLinkHoverColor"),
      bankHighlightColor: readStringField(formData, "bankHighlightColor"),
      bankAccountHighlightColor: readStringField(formData, "bankAccountHighlightColor"),
      bankNameHighlightColor: readStringField(formData, "bankNameHighlightColor"),
      bankNumberHighlightColor: readStringField(formData, "bankNumberHighlightColor"),
      logoBackground: readStringField(formData, "logoBackground"),
      villaCardStyle: readStringField(formData, "villaCardStyle"),
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
      villaDetailSeoKeywords: readStringArrayField(
        formData,
        "villaDetailSeoKeywords",
      ),
      tiktokAccountUrl: "",
      tiktokVideoUrls: [],
    }),
    ok: true,
  };
}

export function buildSiteSettingsSavePayload({
  currentSettings,
  draft,
  uploadedAssets,
}: {
  currentSettings: SiteSettings;
  draft: SiteSettingsDraft;
  uploadedAssets: UploadedAsset[];
}) {
  const logoUpload = uploadedAssets.find((asset) => asset.assetType === "logo");
  const faviconUpload = uploadedAssets.find(
    (asset) => asset.assetType === "favicon",
  );
  const heroUpload = uploadedAssets.find((asset) => asset.assetType === "hero");
  const seoOgImageUpload = uploadedAssets.find(
    (asset) => asset.assetType === "seo-og",
  );
  const searchSeoOgImageUpload = uploadedAssets.find(
    (asset) => asset.assetType === "search-seo-og",
  );
  const guidesSeoOgImageUpload = uploadedAssets.find(
    (asset) => asset.assetType === "guides-seo-og",
  );

  return {
    id: SITE_SETTINGS_ID,
    site_name: draft.siteName,
    primary_color: draft.primaryColor,
    accent_color: draft.accentColor,
    header_link_color: draft.headerLinkColor,
    header_link_hover_color: draft.headerLinkHoverColor,
    footer_link_color: draft.footerLinkColor,
    footer_link_hover_color: draft.footerLinkHoverColor,
    bank_highlight_color: draft.bankHighlightColor,
    bank_account_highlight_color: draft.bankAccountHighlightColor,
    bank_name_highlight_color: draft.bankNameHighlightColor,
    bank_number_highlight_color: draft.bankNumberHighlightColor,
    logo_background: draft.logoBackground,
    villa_card_style: draft.villaCardStyle,
    logo_image_path: logoUpload?.path ?? currentSettings.logoImage.path,
    logo_image_url: logoUpload?.publicUrl ?? currentSettings.logoImage.url,
    favicon_image_path: faviconUpload?.path ?? currentSettings.faviconImage.path,
    favicon_image_url: faviconUpload?.publicUrl ?? currentSettings.faviconImage.url,
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
    seo_og_image_url: seoOgImageUpload?.publicUrl ?? draft.seoOgImageUrl,
    seo_og_image_alt: draft.seoOgImageAlt,
    seo_business_name: draft.seoBusinessName,
    seo_same_as_urls: draft.seoSameAsUrls,
    search_seo_title: draft.searchSeoTitle,
    search_seo_description: draft.searchSeoDescription,
    search_seo_keywords: draft.searchSeoKeywords,
    search_seo_og_image_url:
      searchSeoOgImageUpload?.publicUrl ?? draft.searchSeoOgImageUrl,
    search_seo_og_image_alt: draft.searchSeoOgImageAlt,
    guides_seo_title: draft.guidesSeoTitle,
    guides_seo_description: draft.guidesSeoDescription,
    guides_seo_keywords: draft.guidesSeoKeywords,
    guides_seo_og_image_url:
      guidesSeoOgImageUpload?.publicUrl ?? draft.guidesSeoOgImageUrl,
    guides_seo_og_image_alt: draft.guidesSeoOgImageAlt,
    villa_detail_seo_keywords: draft.villaDetailSeoKeywords,
  };
}

function isMissingColumnError(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42703" ||
    (message.includes("column") && message.includes("does not exist")) ||
    message.includes("schema cache") ||
    message.includes("unknown column")
  );
}

export async function loadAdminSiteSettings(
  supabase: HomeConfigSupabaseClient,
): Promise<{
  data: SiteSettingsRow | null;
  error: SupabaseLikeError | null;
}> {
  let lastError: SupabaseLikeError | null = null;

  for (const select of SITE_SETTINGS_SELECTS) {
    const result = await supabase
      .from("site_settings")
      .select(select)
      .eq("id", SITE_SETTINGS_ID)
      .maybeSingle();

    if (!result.error) {
      return {
        data: (result.data as SiteSettingsRow | null) ?? null,
        error: null,
      };
    }

    if (!isMissingColumnError(result.error)) {
      return { data: null, error: result.error };
    }

    lastError = result.error;
  }

  return { data: null, error: lastError };
}

export async function buildAdminSiteSettingsResponse(
  supabase: HomeConfigSupabaseClient,
) {
  const { data, error } = await loadAdminSiteSettings(supabase);

  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to load site settings.");
  }

  return Response.json({
    settings: normalizeSiteSettingsRow((data as SiteSettingsRow | null) ?? null),
  });
}

export async function saveAdminSiteSettings(
  request: Request,
  supabase: HomeConfigSupabaseClient,
) {
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
    supabase,
  );

  if (loadError) {
    return adminSupabaseErrorResponse(loadError, "Unable to load site settings.");
  }

  const currentSettings = normalizeSiteSettingsRow(
    (existingRow as SiteSettingsRow | null) ?? null,
  );
  const uploadAssetsResult = await uploadSiteSettingsAssets(
    supabase,
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
  const historyResult = await recordUploadedAssets(supabase, uploadedAssets);

  if (!historyResult.ok) {
    const cleanupWarnings = await cleanupFailedSiteAssetSave(
      supabase,
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

  const { error: saveError } = await supabase
    .from("site_settings")
    .upsert(savePayload, { onConflict: "id" });

  if (saveError) {
    const cleanupWarnings = await cleanupFailedSiteAssetSave(
      supabase,
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
    supabase,
    historyResult.recordedAssets,
  );

  if (historyUpdateError) {
    console.error("Unable to mark previous site asset uploads inactive", historyUpdateError);
  }

  const warnings = [
    ...(historyUpdateError
      ? ["Unable to mark previous site asset uploads inactive."]
      : []),
    ...(uploadedAssets.length > 0 ? await cleanupRetainedAssets(supabase) : []),
  ];
  const { data: savedRow, error: reloadError } = await loadAdminSiteSettings(
    supabase,
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

export function buildSavedSettingsRow(
  existingRow: SiteSettingsRow | null,
  savePayload: Record<string, unknown>,
): SiteSettingsRow {
  return {
    ...(existingRow ?? {}),
    ...savePayload,
  } as SiteSettingsRow;
}
