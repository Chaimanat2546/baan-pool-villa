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

export interface SiteSettings {
  siteName: string;
  primaryColor: string;
  accentColor: string;
  logoImage: SiteImageSettings;
  heroImage: SiteImageSettings;
  bank: SiteBankSettings;
  contact: SiteContactSettings;
}

export interface SiteSettingsLoadResult {
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
}
