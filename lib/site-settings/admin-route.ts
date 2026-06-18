import {
  adminSupabaseErrorResponse,
  type HomeConfigSupabaseClient,
  type SupabaseLikeError,
} from "@/lib/admin/route-helpers";
import {
  getOptionalUpload,
  readPhoneContactsField,
  readStringArrayField,
  readStringField,
} from "@/lib/site-settings/admin-form-fields";
import {
  normalizeSiteSettingsDraft,
  normalizeSiteSettingsRow,
  validateUploadMetadata,
} from "@/lib/site-settings/validation";
import { SITE_SETTINGS_ID } from "./defaults";
import type { UploadedAsset } from "./admin-asset-uploads";
import type {
  SiteSettings,
  SiteSettingsDraft,
  SiteAssetType,
  SiteSettingsRow,
} from "./types";

const SITE_SETTINGS_SELECT =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_keywords,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,search_seo_title,search_seo_description,search_seo_keywords,search_seo_og_image_url,search_seo_og_image_alt,guides_seo_title,guides_seo_description,guides_seo_keywords,guides_seo_og_image_url,guides_seo_og_image_alt,villa_detail_seo_keywords,detail_layout,tiktok_account_url,tiktok_video_urls";
const SITE_SETTINGS_SELECT_WITHOUT_KEYWORDS =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,search_seo_title,search_seo_description,search_seo_og_image_url,search_seo_og_image_alt,guides_seo_title,guides_seo_description,guides_seo_og_image_url,guides_seo_og_image_alt,detail_layout,tiktok_account_url,tiktok_video_urls";
const SITE_SETTINGS_SELECT_WITHOUT_PAGE_SEO =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,detail_layout,tiktok_account_url,tiktok_video_urls";
const SITE_SETTINGS_SELECT_WITHOUT_TIKTOK =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,detail_layout";
const SITE_SETTINGS_GENERAL_SELECT =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls";

export const ASSET_UPLOAD_FIELDS: { assetType: SiteAssetType; fieldName: string }[] = [
  { assetType: "logo", fieldName: "logo" },
  { assetType: "hero", fieldName: "hero" },
];

export interface SiteSettingsUploadFile {
  assetType: SiteAssetType;
  file: File;
}

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

export function readSiteSettingsUploadFiles(formData: FormData): {
  errors: string[];
  uploadFiles: SiteSettingsUploadFile[];
} {
  const errors: string[] = [];
  const uploadFiles: SiteSettingsUploadFile[] = [];

  ASSET_UPLOAD_FIELDS.forEach(({ assetType, fieldName }) => {
    const file = getOptionalUpload(formData, fieldName);

    if (!file) {
      return;
    }

    errors.push(...validateUploadMetadata(assetType, file.type, file.size));
    uploadFiles.push({ assetType, file });
  });

  return { errors, uploadFiles };
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
  const heroUpload = uploadedAssets.find((asset) => asset.assetType === "hero");

  return {
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
  const primary = await supabase
    .from("site_settings")
    .select(SITE_SETTINGS_SELECT)
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle();

  if (!primary.error) {
    return {
      data: (primary.data as SiteSettingsRow | null) ?? null,
      error: null,
    };
  }

  if (!isMissingColumnError(primary.error)) {
    return { data: null, error: primary.error };
  }

  const fallbackWithoutKeywords = await supabase
    .from("site_settings")
    .select(SITE_SETTINGS_SELECT_WITHOUT_KEYWORDS)
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle();

  if (!fallbackWithoutKeywords.error) {
    return {
      data: (fallbackWithoutKeywords.data as SiteSettingsRow | null) ?? null,
      error: null,
    };
  }

  if (!isMissingColumnError(fallbackWithoutKeywords.error)) {
    return { data: null, error: fallbackWithoutKeywords.error };
  }

  const fallbackWithoutPageSeo = await supabase
    .from("site_settings")
    .select(SITE_SETTINGS_SELECT_WITHOUT_PAGE_SEO)
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle();

  if (!fallbackWithoutPageSeo.error) {
    return {
      data: (fallbackWithoutPageSeo.data as SiteSettingsRow | null) ?? null,
      error: null,
    };
  }

  if (!isMissingColumnError(fallbackWithoutPageSeo.error)) {
    return { data: null, error: fallbackWithoutPageSeo.error };
  }

  const fallback = await supabase
    .from("site_settings")
    .select(SITE_SETTINGS_SELECT_WITHOUT_TIKTOK)
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle();

  if (!fallback.error) {
    return {
      data: (fallback.data as SiteSettingsRow | null) ?? null,
      error: null,
    };
  }

  if (!isMissingColumnError(fallback.error)) {
    return { data: null, error: fallback.error };
  }

  const general = await supabase
    .from("site_settings")
    .select(SITE_SETTINGS_GENERAL_SELECT)
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle();

  if (!general.error) {
    return {
      data: (general.data as SiteSettingsRow | null) ?? null,
      error: null,
    };
  }

  return { data: null, error: general.error };
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

export function buildSavedSettingsRow(
  existingRow: SiteSettingsRow | null,
  savePayload: Record<string, unknown>,
): SiteSettingsRow {
  return {
    ...(existingRow ?? {}),
    ...savePayload,
  } as SiteSettingsRow;
}
