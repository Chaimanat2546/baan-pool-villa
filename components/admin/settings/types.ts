import type { SitePhoneContact, SiteSettings } from "@/lib/site-settings/types";

export interface AdminSettingsDraft {
  accentColor: string;
  heroFile: File | null;
  heroImageAlt: string;
  logoFile: File | null;
  primaryColor: string;
  siteName: string;
  bankAccountName: string;
  bankName: string;
  bankAccountNumber: string;
  phoneContacts: SitePhoneContact[];
  messengerUrl: string;
  lineId: string;
  lineUrl: string;
  seoTitle: string;
  seoDescription: string;
  seoOgImageUrl: string;
  seoOgImageAlt: string;
  seoBusinessName: string;
  seoSameAsUrls: string[];
  tiktokAccountUrl: string;
  tiktokVideoUrls: string[];
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
