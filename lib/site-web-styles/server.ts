import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { createHomeConfigClient } from "@/lib/home-sections/supabase";
import { cloneDefaultSiteWebStyles } from "./defaults";
import type { SiteWebStyles } from "./types";
import { normalizeSiteWebStyles } from "./validation";

const getCachedSiteWebStyles = unstable_cache(
  async (): Promise<SiteWebStyles> => {
    const { data, error } = await createHomeConfigClient()
      .from("site_web_styles")
      .select("style_type,style_variant,options");

    return error || !data
      ? cloneDefaultSiteWebStyles()
      : normalizeSiteWebStyles(data);
  },
  [`${CACHE_TAGS.siteWebStyles}:v1`],
  {
    revalidate: CACHE_REVALIDATE_SECONDS.siteWebStyles,
    tags: [CACHE_TAGS.siteWebStyles],
  },
);

export const getSiteWebStyles = cache(async (): Promise<SiteWebStyles> => {
  try {
    const styles = await getCachedSiteWebStyles();
    return {
      gallery: { ...styles.gallery },
      header: { ...styles.header },
      houseCard: { ...styles.houseCard },
    };
  } catch {
    return cloneDefaultSiteWebStyles();
  }
});
