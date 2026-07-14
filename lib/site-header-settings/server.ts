import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { createHomeConfigClient } from "@/lib/home-sections/supabase";
import { DEFAULT_SITE_HEADER_SETTINGS } from "./defaults";
import type { SiteHeaderSettings } from "./types";
import { normalizeDesktopHeaderVariant } from "./validation";

const getCachedSiteHeaderSettings = unstable_cache(
  async (): Promise<SiteHeaderSettings> => {
    const { data, error } = await createHomeConfigClient()
      .from("site_header_settings")
      .select("desktop_header_variant")
      .eq("singleton_id", true)
      .maybeSingle();

    if (error || !data) return DEFAULT_SITE_HEADER_SETTINGS;

    return {
      desktopHeaderVariant: normalizeDesktopHeaderVariant(
        (data as { desktop_header_variant?: unknown }).desktop_header_variant,
      ),
    };
  },
  [`${CACHE_TAGS.siteHeaderSettings}:v1`],
  {
    revalidate: CACHE_REVALIDATE_SECONDS.siteHeaderSettings,
    tags: [CACHE_TAGS.siteHeaderSettings],
  },
);

export const getSiteHeaderSettings = cache(async (): Promise<SiteHeaderSettings> => {
  try {
    return await getCachedSiteHeaderSettings();
  } catch {
    return DEFAULT_SITE_HEADER_SETTINGS;
  }
});
