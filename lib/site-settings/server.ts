import "server-only";

import { DEFAULT_SITE_SETTINGS, SITE_SETTINGS_ID } from "./defaults";
import { createHomeConfigClient } from "./supabase";
import type { SiteSettingsLoadResult, SiteSettingsRow } from "./types";
import { normalizeSiteSettingsRow } from "./validation";

const SITE_SETTINGS_SELECT =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,line_id,line_url";
const LEGACY_SITE_SETTINGS_SELECT =
  "id,site_name,primary_color,accent_color,logo_image_path,logo_image_url,hero_image_path,hero_image_url,hero_image_alt";

export async function getSiteSettings(): Promise<SiteSettingsLoadResult> {
  try {
    const supabase = createHomeConfigClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select(SITE_SETTINGS_SELECT)
      .eq("id", SITE_SETTINGS_ID)
      .maybeSingle();

    if (error) {
      const { data: legacyData, error: legacyError } = await supabase
        .from("site_settings")
        .select(LEGACY_SITE_SETTINGS_SELECT)
        .eq("id", SITE_SETTINGS_ID)
        .maybeSingle();

      if (legacyError || !legacyData) {
        return { settings: DEFAULT_SITE_SETTINGS, source: "fallback" };
      }

      return {
        settings: normalizeSiteSettingsRow(legacyData as SiteSettingsRow),
        source: "config",
      };
    }

    if (!data) {
      return { settings: DEFAULT_SITE_SETTINGS, source: "fallback" };
    }

    return {
      settings: normalizeSiteSettingsRow(data as SiteSettingsRow),
      source: "config",
    };
  } catch {
    return { settings: DEFAULT_SITE_SETTINGS, source: "fallback" };
  }
}
