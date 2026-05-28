import type { SiteSettings } from "@/lib/site-settings/types";

export interface AdminSettingsDraft {
  accentColor: string;
  heroFile: File | null;
  heroImageAlt: string;
  logoFile: File | null;
  primaryColor: string;
  siteName: string;
}

export interface AdminSiteSettingsResponse {
  code?: string;
  details?: string;
  error?: string;
  errors?: string[];
  hint?: string;
  settings?: SiteSettings;
  warning?: string;
  warnings?: string[];
}
