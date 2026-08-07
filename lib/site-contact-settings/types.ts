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

export interface SiteContactChannels {
  phoneContacts: SitePhoneContact[];
  messengerUrl: string;
  showFacebookTimeline: boolean;
  lineId: string;
  lineUrl: string;
}

export interface SiteContactSettings {
  bank: SiteBankSettings;
  contact: SiteContactChannels;
}

export interface SiteContactSettingsDraft {
  bankAccountName: string;
  bankName: string;
  bankAccountNumber: string;
  phoneContacts: SitePhoneContact[];
  messengerUrl: string;
  showFacebookTimeline: boolean;
  lineId: string;
  lineUrl: string;
}

export interface SiteContactSettingsRow {
  singleton_id: boolean;
  bank_account_name: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  phone_contacts: unknown;
  messenger_url: string | null;
  show_facebook_timeline: boolean | null;
  line_id: string | null;
  line_url: string | null;
}

export interface SiteContactSettingsLoadResult {
  degraded: boolean;
  settings: SiteContactSettings;
  source: "config" | "fallback";
}
