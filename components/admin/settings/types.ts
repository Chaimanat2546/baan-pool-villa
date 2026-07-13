import type { SiteLogoBackground } from "@/lib/site-settings/logo-background";
import type { SitePhoneContact, SiteSettings } from "@/lib/site-settings/types";

export interface BrandSettingsDraft {
  faviconFile: File | null;
  faviconImage: SiteSettings["faviconImage"];
  logoBackground: SiteLogoBackground;
  logoFile: File | null;
  logoImage: SiteSettings["logoImage"];
  siteName: string;
}

export type ThemeSettingsDraft = Pick<
  AdminSettingsDraft,
  | "primaryColor"
  | "accentColor"
  | "headerLinkColor"
  | "headerLinkHoverColor"
  | "footerLinkColor"
  | "footerLinkHoverColor"
  | "bankHighlightColor"
  | "bankAccountHighlightColor"
  | "bankNameHighlightColor"
  | "bankNumberHighlightColor"
>;

export interface HeroSettingsDraft {
  heroFile: File | null;
  heroImage: SiteSettings["heroImage"];
  heroImageAlt: string;
}

export type SeoSettingsDraft = import("@/lib/site-settings/admin-section-contracts").SiteSettingsSectionDraftMap["seo"] & {
  seoOgImageFile: File | null;
  searchSeoOgImageFile: File | null;
  guidesSeoOgImageFile: File | null;
  seo: SiteSettings["seo"];
  pageSeo: SiteSettings["pageSeo"];
};

export type ContactSettingsDraft = import("@/lib/site-settings/admin-section-contracts").SiteSettingsSectionDraftMap["contact"];

export interface AdminSettingsDraft {
  accentColor: string;
  faviconFile: File | null;
  heroFile: File | null;
  heroImageAlt: string;
  logoFile: File | null;
  primaryColor: string;
  headerLinkColor: string;
  headerLinkHoverColor: string;
  footerLinkColor: string;
  footerLinkHoverColor: string;
  bankHighlightColor: string;
  bankAccountHighlightColor: string;
  bankNameHighlightColor: string;
  bankNumberHighlightColor: string;
  logoBackground: SiteLogoBackground;
  villaCardStyle: SiteSettings["villaCardStyle"];
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
