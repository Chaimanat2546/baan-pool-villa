import type {
  HomeConfigSupabaseClient,
  SupabaseLikeError,
} from "@/lib/admin/route-helpers";
import { SITE_SETTINGS_ID } from "./defaults";
import type {
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

export function buildSavedSettingsRow(
  existingRow: SiteSettingsRow | null,
  savePayload: Record<string, unknown>,
): SiteSettingsRow {
  return {
    ...(existingRow ?? {}),
    ...savePayload,
  } as SiteSettingsRow;
}
