import "server-only";

import { cache } from "react";

import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { createHomeConfigCachedLoader } from "@/lib/home-sections/cache";
import { SITE_SETTINGS_ID } from "@/lib/site-settings/defaults";
import { createHomeConfigClient } from "@/lib/site-settings/supabase";
import type { SiteSettingsRow } from "@/lib/site-settings/types";
import {
  mapSiteSeoRowsToLegacyProjection,
  type SiteSeoSettingsRow,
} from "./rows";

const LEGACY_SITE_SEO_SELECT =
  "seo_title,seo_description,seo_keywords,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,search_seo_title,search_seo_description,search_seo_keywords,search_seo_og_image_url,search_seo_og_image_alt,guides_seo_title,guides_seo_description,guides_seo_keywords,guides_seo_og_image_url,guides_seo_og_image_alt,villa_detail_seo_keywords";

const getCachedSiteSeoSettingsProjection = createHomeConfigCachedLoader(
  async (): Promise<Partial<SiteSettingsRow> | null> => {
    try {
      const { data, error } = await createHomeConfigClient()
        .from("site_seo_settings")
        .select("page_type,settings");

      if (!error && data) {
        return mapSiteSeoRowsToLegacyProjection(data as SiteSeoSettingsRow[]);
      }
    } catch {
      // The legacy projection below keeps expand rollout reads available.
    }

    try {
      const legacy = await createHomeConfigClient()
        .from("site_settings")
        .select(LEGACY_SITE_SEO_SELECT)
        .eq("id", SITE_SETTINGS_ID)
        .maybeSingle();

      return legacy.error || !legacy.data
        ? null
        : (legacy.data as Partial<SiteSettingsRow>);
    } catch {
      return null;
    }
  },
  [`${CACHE_TAGS.siteSeoSettings}:v1`],
  {
    revalidate: CACHE_REVALIDATE_SECONDS.siteSeoSettings,
    tags: [CACHE_TAGS.siteSeoSettings],
  },
);

export const getSiteSeoSettingsProjection = cache(
  getCachedSiteSeoSettingsProjection,
);
