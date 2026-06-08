import type { AnyDetailLayoutConfig } from "../detail-layout/types";

export type SiteAssetType = "logo" | "hero";

export interface SiteAssetUploadRecord {
  assetType: SiteAssetType;
  createdAt: string;
  id: string;
  isCurrent: boolean;
  storageBucket: string;
  storagePath: string;
}

export interface SiteImageSettings {
  path: string;
  url: string;
  alt: string;
}

export interface SiteBankSettings {
  accountName: string;
  bankName: string;
  accountNumber: string;
}

export interface SitePhoneContact {
  name: string;
  phone: string;
  time: string;
}

export interface SiteContactSettings {
  phoneContacts: SitePhoneContact[];
  messengerUrl: string;
  lineId: string;
  lineUrl: string;
}

export interface SiteSeoSettings {
  title: string;
  description: string;
  ogImage: SiteImageSettings;
  businessName: string;
  sameAsUrls: string[];
}

export interface SitePageSeoSettings {
  guides: Pick<SiteSeoSettings, "description" | "ogImage" | "title">;
  search: Pick<SiteSeoSettings, "description" | "ogImage" | "title">;
}

export interface SiteTikTokVideoSettings {
  url: string;
  videoId: string;
}

export interface SiteTikTokSettings {
  accountUrl: string;
  videos: SiteTikTokVideoSettings[];
}

export interface SiteSettings {
  siteName: string;
  primaryColor: string;
  accentColor: string;
  logoImage: SiteImageSettings;
  heroImage: SiteImageSettings;
  bank: SiteBankSettings;
  contact: SiteContactSettings;
  seo: SiteSeoSettings;
  pageSeo: SitePageSeoSettings;
  tiktok: SiteTikTokSettings;
  detailLayout: AnyDetailLayoutConfig;
}

export interface SiteSettingsLoadResult {
  degraded: boolean;
  settings: SiteSettings;
  source: "config" | "fallback";
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
  bank_account_name?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  phone_contacts?: unknown;
  messenger_url?: string | null;
  line_id?: string | null;
  line_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_og_image_url?: string | null;
  seo_og_image_alt?: string | null;
  seo_business_name?: string | null;
  seo_same_as_urls?: unknown;
  search_seo_title?: string | null;
  search_seo_description?: string | null;
  search_seo_og_image_url?: string | null;
  search_seo_og_image_alt?: string | null;
  guides_seo_title?: string | null;
  guides_seo_description?: string | null;
  guides_seo_og_image_url?: string | null;
  guides_seo_og_image_alt?: string | null;
  tiktok_account_url?: string | null;
  tiktok_video_urls?: unknown;
  detail_layout?: unknown;
}

export interface SiteSettingsDraft {
  siteName: string;
  primaryColor: string;
  accentColor: string;
  heroImageAlt: string;
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
  searchSeoTitle: string;
  searchSeoDescription: string;
  searchSeoOgImageUrl: string;
  searchSeoOgImageAlt: string;
  guidesSeoTitle: string;
  guidesSeoDescription: string;
  guidesSeoOgImageUrl: string;
  guidesSeoOgImageAlt: string;
  tiktokAccountUrl: string;
  tiktokVideoUrls: string[];
}
