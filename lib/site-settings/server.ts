import "server-only";

import { unstable_cache } from "next/cache";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { DEFAULT_SITE_SETTINGS, SITE_SETTINGS_ID } from "./defaults";
import { createHomeConfigClient } from "./supabase";
import type { SiteSettingsLoadResult, SiteSettingsRow } from "./types";
import { normalizeSiteSettingsRow } from "./validation";

const SITE_SETTINGS_SELECT =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_keywords,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,search_seo_title,search_seo_description,search_seo_keywords,search_seo_og_image_url,search_seo_og_image_alt,guides_seo_title,guides_seo_description,guides_seo_keywords,guides_seo_og_image_url,guides_seo_og_image_alt,villa_detail_seo_keywords,detail_layout,tiktok_account_url,tiktok_video_urls";
const SITE_SETTINGS_SELECT_WITHOUT_KEYWORDS =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,search_seo_title,search_seo_description,search_seo_og_image_url,search_seo_og_image_alt,guides_seo_title,guides_seo_description,guides_seo_og_image_url,guides_seo_og_image_alt,detail_layout,tiktok_account_url,tiktok_video_urls";
const SITE_SETTINGS_SELECT_WITHOUT_PAGE_SEO =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,detail_layout,tiktok_account_url,tiktok_video_urls";
const SITE_SETTINGS_SELECT_WITHOUT_TIKTOK =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,seo_title,seo_description,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,detail_layout";
const CONTACT_SITE_SETTINGS_SELECT =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url";
const LEGACY_SITE_SETTINGS_SELECT =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt";

const getCachedSiteSettings = unstable_cache(
  async (): Promise<SiteSettingsLoadResult> => {
    const supabase = createHomeConfigClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select(SITE_SETTINGS_SELECT)
      .eq("id", SITE_SETTINGS_ID)
      .maybeSingle();

    if (error) {
      // Fall back through older select shapes so partially migrated CMS tables
      // can still return usable settings during rollout.
      const { data: withoutKeywordsData, error: withoutKeywordsError } = await supabase
        .from("site_settings")
        .select(SITE_SETTINGS_SELECT_WITHOUT_KEYWORDS)
        .eq("id", SITE_SETTINGS_ID)
        .maybeSingle();

      if (!withoutKeywordsError && withoutKeywordsData) {
        return {
          degraded: true,
          settings: normalizeSiteSettingsRow(withoutKeywordsData as SiteSettingsRow),
          source: "config",
        };
      }

      const { data: withoutPageSeoData, error: withoutPageSeoError } = await supabase
        .from("site_settings")
        .select(SITE_SETTINGS_SELECT_WITHOUT_PAGE_SEO)
        .eq("id", SITE_SETTINGS_ID)
        .maybeSingle();

      if (!withoutPageSeoError && withoutPageSeoData) {
        return {
          degraded: true,
          settings: normalizeSiteSettingsRow(withoutPageSeoData as SiteSettingsRow),
          source: "config",
        };
      }

      const { data: withoutTikTokData, error: withoutTikTokError } = await supabase
        .from("site_settings")
        .select(SITE_SETTINGS_SELECT_WITHOUT_TIKTOK)
        .eq("id", SITE_SETTINGS_ID)
        .maybeSingle();

      if (!withoutTikTokError && withoutTikTokData) {
        return {
          degraded: true,
          settings: normalizeSiteSettingsRow(withoutTikTokData as SiteSettingsRow),
          source: "config",
        };
      }

      const { data: contactData, error: contactError } = await supabase
        .from("site_settings")
        .select(CONTACT_SITE_SETTINGS_SELECT)
        .eq("id", SITE_SETTINGS_ID)
        .maybeSingle();

      if (!contactError && contactData) {
        return {
          degraded: true,
          settings: normalizeSiteSettingsRow(contactData as SiteSettingsRow),
          source: "config",
        };
      }

      const { data: legacyData, error: legacyError } = await supabase
        .from("site_settings")
        .select(LEGACY_SITE_SETTINGS_SELECT)
        .eq("id", SITE_SETTINGS_ID)
        .maybeSingle();

      if (legacyError || !legacyData) {
        throw new Error("Site settings config is unavailable");
      }

      return {
        degraded: false,
        settings: normalizeSiteSettingsRow(legacyData as SiteSettingsRow),
        source: "config",
      };
    }

    if (!data) {
      throw new Error("Site settings config is unavailable");
    }

    return {
      degraded: false,
      settings: normalizeSiteSettingsRow(data as SiteSettingsRow),
      source: "config",
    };
  },
  [CACHE_TAGS.siteSettings],
  {
    revalidate: CACHE_REVALIDATE_SECONDS.siteSettings,
    tags: [CACHE_TAGS.siteSettings],
  },
);

/**
 * Loads the resolved site settings from the cached CMS config and falls back
 * to local defaults when remote settings are unavailable.
 *
 * @returns The resolved site settings, including whether the result is
 * degraded and whether it came from remote config or local fallback defaults.
 */
export async function getSiteSettings(): Promise<SiteSettingsLoadResult> {
  try {
    return await getCachedSiteSettings();
  } catch {
    return {
      degraded: true,
      settings: DEFAULT_SITE_SETTINGS,
      source: "fallback",
    };
  }
}
