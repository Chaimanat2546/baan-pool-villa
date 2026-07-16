import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { getSiteSeoSettingsProjection } from "@/lib/site-seo-settings/server";
import { DEFAULT_SITE_SETTINGS, SITE_SETTINGS_ID } from "./defaults";
import { createHomeConfigClient } from "./supabase";
import type { SiteSettingsLoadResult, SiteSettingsRow } from "./types";
import { normalizeSiteSettingsRow } from "./validation";

const SITE_SETTINGS_SELECT =
  "id,site_name,primary_color,accent_color,header_link_color,header_link_hover_color,footer_link_color,footer_link_hover_color,bank_highlight_color,bank_account_highlight_color,bank_name_highlight_color,bank_number_highlight_color,logo_background,logo_image_path,logo_image_url,favicon_image_path,favicon_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,detail_layout,tiktok_account_url,tiktok_video_urls,google_tag_manager_id";
const SITE_SETTINGS_SELECT_WITHOUT_MARKETING_TAGS =
  "id,site_name,primary_color,accent_color,header_link_color,header_link_hover_color,footer_link_color,footer_link_hover_color,bank_highlight_color,bank_account_highlight_color,bank_name_highlight_color,bank_number_highlight_color,logo_background,logo_image_path,logo_image_url,favicon_image_path,favicon_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,detail_layout,tiktok_account_url,tiktok_video_urls";
const SITE_SETTINGS_SELECT_WITHOUT_TIKTOK =
  "id,site_name,primary_color,accent_color,header_link_color,header_link_hover_color,footer_link_color,footer_link_hover_color,bank_highlight_color,bank_account_highlight_color,bank_name_highlight_color,bank_number_highlight_color,logo_background,logo_image_path,logo_image_url,favicon_image_path,favicon_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url,detail_layout";
const CONTACT_SITE_SETTINGS_SELECT =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url";
const LEGACY_SITE_SETTINGS_SELECT =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt";
const SITE_SETTINGS_CACHE_KEY = `${CACHE_TAGS.siteSettings}:v4`;

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
      const {
        data: withoutMarketingTagsData,
        error: withoutMarketingTagsError,
      } = await supabase
        .from("site_settings")
        .select(SITE_SETTINGS_SELECT_WITHOUT_MARKETING_TAGS)
        .eq("id", SITE_SETTINGS_ID)
        .maybeSingle();

      if (!withoutMarketingTagsError && withoutMarketingTagsData) {
        return {
          degraded: true,
          settings: normalizeSiteSettingsRow(
            withoutMarketingTagsData as SiteSettingsRow,
          ),
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
  [SITE_SETTINGS_CACHE_KEY],
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
export const getSiteSettings = cache(async (): Promise<SiteSettingsLoadResult> => {
  try {
    const [result, seoProjection] = await Promise.all([
      getCachedSiteSettings(),
      getSiteSeoSettingsProjection().catch(() => null),
    ]);

    if (!seoProjection) {
      return { ...result, degraded: true };
    }

    const seoSettings = normalizeSiteSettingsRow({
      id: SITE_SETTINGS_ID,
      ...seoProjection,
    } as SiteSettingsRow);

    return {
      ...result,
      settings: {
        ...result.settings,
        seo: seoSettings.seo,
        pageSeo: seoSettings.pageSeo,
      },
    };
  } catch {
    return {
      degraded: true,
      settings: DEFAULT_SITE_SETTINGS,
      source: "fallback",
    };
  }
});
