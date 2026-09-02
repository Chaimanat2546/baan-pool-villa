import type { SiteWebStyles, WebStyleType } from "./types";
import { DEFAULT_GALLERY_CATEGORY_ORDER } from "./gallery-categories";

export const DEFAULT_SITE_WEB_STYLES: SiteWebStyles = {
  gallery: {
    categoryOrder: DEFAULT_GALLERY_CATEGORY_ORDER,
    imageSource: "standard",
    showCover: true,
    variant: "lightbox",
  },
  header: { variant: "centered-contact" },
  houseCard: { variant: "classic" },
};

export function cloneDefaultSiteWebStyles(): SiteWebStyles {
  return {
    gallery: {
      ...DEFAULT_SITE_WEB_STYLES.gallery,
      categoryOrder: [
        ...(DEFAULT_SITE_WEB_STYLES.gallery.categoryOrder ??
          DEFAULT_GALLERY_CATEGORY_ORDER),
      ],
    },
    header: { ...DEFAULT_SITE_WEB_STYLES.header },
    houseCard: { ...DEFAULT_SITE_WEB_STYLES.houseCard },
  };
}

export function getDefaultWebStyle(type: WebStyleType) {
  const defaults = cloneDefaultSiteWebStyles();
  return type === "house_card" ? defaults.houseCard : defaults[type];
}
