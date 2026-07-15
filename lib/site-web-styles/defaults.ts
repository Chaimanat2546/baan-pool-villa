import type { SiteWebStyles, WebStyleType } from "./types";

export const DEFAULT_SITE_WEB_STYLES: SiteWebStyles = {
  gallery: { variant: "lightbox" },
  header: { variant: "centered-contact" },
  houseCard: { variant: "classic" },
};

export function cloneDefaultSiteWebStyles(): SiteWebStyles {
  return {
    gallery: { ...DEFAULT_SITE_WEB_STYLES.gallery },
    header: { ...DEFAULT_SITE_WEB_STYLES.header },
    houseCard: { ...DEFAULT_SITE_WEB_STYLES.houseCard },
  };
}

export function getDefaultWebStyle(type: WebStyleType) {
  const defaults = cloneDefaultSiteWebStyles();
  return type === "house_card" ? defaults.houseCard : defaults[type];
}
