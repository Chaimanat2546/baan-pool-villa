import "server-only";

import { getSiteWebStyles } from "@/lib/site-web-styles/server";
import { DEFAULT_SITE_HEADER_SETTINGS } from "./defaults";
import type { SiteHeaderSettings } from "./types";

export async function getSiteHeaderSettings(): Promise<SiteHeaderSettings> {
  try {
    const styles = await getSiteWebStyles();
    return { desktopHeaderVariant: styles.header.variant };
  } catch {
    return { ...DEFAULT_SITE_HEADER_SETTINGS };
  }
}
