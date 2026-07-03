import type { SiteLogoBackground } from "@/lib/site-settings/logo-background";
import type { SitePhoneContact, SiteSettings } from "@/lib/site-settings/types";

export interface AdminSettingsDraft {
  accentColor: string;
  heroFile: File | null;
  heroImageAlt: string;
  logoFile: File | null;
  primaryColor: string;
  headerLinkColor: string;
  headerLinkHoverColor: string;
  footerLinkColor: string;
  footerLinkHoverColor: string;
  bankHighlightColor: string;
  logoBackground: SiteLogoBackground;
  seoOgImageFile: File | null;
  searchSeoOgImageFile: File | null;
  guidesSeoOgImageFile: File | null;
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
  seoKeywords: string[];
  seoOgImageUrl: string;
  seoOgImageAlt: string;
  seoBusinessName: string;
  seoSameAsUrls: string[];
  searchSeoTitle: string;
  searchSeoDescription: string;
  searchSeoKeywords: string[];
  searchSeoOgImageUrl: string;
  searchSeoOgImageAlt: string;
  guidesSeoTitle: string;
  guidesSeoDescription: string;
  guidesSeoKeywords: string[];
  guidesSeoOgImageUrl: string;
  guidesSeoOgImageAlt: string;
  villaDetailSeoKeywords: string[];
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
