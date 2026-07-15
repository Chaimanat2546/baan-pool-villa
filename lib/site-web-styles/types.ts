export type WebStyleType = "header" | "gallery" | "house_card";
export type DesktopHeaderVariant = "centered-contact" | "right-booking";
export type GalleryModalVariant = "lightbox" | "categorized-grid";
export type SiteVillaCardStyle = "classic" | "gallery";

export interface GalleryStyleOptions {
  backgroundColor?: string;
  textColor?: string;
}

export interface GalleryStyleSettings extends GalleryStyleOptions {
  variant: GalleryModalVariant;
}

export interface SiteWebStyles {
  gallery: GalleryStyleSettings;
  header: { variant: DesktopHeaderVariant };
  houseCard: { variant: SiteVillaCardStyle };
}

export interface SiteWebStyleRow {
  options?: unknown;
  style_type?: unknown;
  style_variant?: unknown;
}
