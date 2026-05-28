export type SiteAssetType = "logo" | "hero";

export interface SiteImageSettings {
  path: string;
  url: string;
  alt: string;
}

export interface SiteSettings {
  siteName: string;
  primaryColor: string;
  accentColor: string;
  logoImage: SiteImageSettings;
  heroImage: SiteImageSettings;
}

export interface SiteSettingsRow {
  id: string;
  site_name: string | null;
  primary_color: string | null;
  accent_color: string | null;
  logo_image_path: string | null;
  logo_image_url: string | null;
  hero_image_path: string | null;
  hero_image_url: string | null;
  hero_image_alt: string | null;
}

export interface SiteSettingsDraft {
  siteName: string;
  primaryColor: string;
  accentColor: string;
  heroImageAlt: string;
}
