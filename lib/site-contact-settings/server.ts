import "server-only";

import { cache } from "react";

import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { createHomeConfigCachedLoader } from "@/lib/home-sections/cache";
import { createHomeConfigClient } from "@/lib/site-settings/supabase";
import { cloneDefaultSiteContactSettings } from "./defaults";
import type {
  SiteContactSettings,
  SiteContactSettingsLoadResult,
  SiteContactSettingsRow,
} from "./types";
import { normalizeSiteContactSettingsRow } from "./validation";

const SITE_CONTACT_SETTINGS_SELECT =
  "singleton_id,bank_account_name,bank_name,bank_account_number,phone_contacts,messenger_url,facebook_page_name,show_facebook_timeline,line_id,line_url";

const getCachedSiteContactSettings = createHomeConfigCachedLoader(
  async (): Promise<SiteContactSettings> => {
    const { data, error } = await createHomeConfigClient()
      .from("site_contact_settings")
      .select(SITE_CONTACT_SETTINGS_SELECT)
      .eq("singleton_id", true)
      .maybeSingle();

    if (error || !data) throw new Error("Site contact settings are unavailable");
    return normalizeSiteContactSettingsRow(data as SiteContactSettingsRow);
  },
  [`${CACHE_TAGS.siteContactSettings}:v1`],
  {
    revalidate: CACHE_REVALIDATE_SECONDS.siteContactSettings,
    tags: [CACHE_TAGS.siteContactSettings],
  },
);

export const getSiteContactSettings = cache(
  async (): Promise<SiteContactSettingsLoadResult> => {
    try {
      return {
        degraded: false,
        settings: await getCachedSiteContactSettings(),
        source: "config",
      };
    } catch {
      return {
        degraded: true,
        settings: cloneDefaultSiteContactSettings(),
        source: "fallback",
      };
    }
  },
);
