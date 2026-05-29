import {
  defaultDescription,
  defaultOgImage,
  defaultTitle,
  siteName,
} from "../seo";
import type {
  SiteBankSettings,
  SiteContactSettings,
  SiteSeoSettings,
  SiteSettings,
} from "./types";

export const SITE_SETTINGS_ID = "global";
export const SITE_ASSETS_BUCKET = "site-assets";
export const SITE_SETTINGS_UPLOAD_LIMIT_BYTES = 6 * 1024 * 1024;

export const SITE_SETTINGS_ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const DEFAULT_SITE_BANK_SETTINGS: SiteBankSettings = {
  accountName: "คุณ อาภัสรา จินดาวา",
  bankName: "ธนาคารกสิกรไทย",
  accountNumber: "398-289-7482",
};

export const DEFAULT_SITE_CONTACT_SETTINGS: SiteContactSettings = {
  phoneContacts: [
    {
      name: "คุณเกม",
      phone: "0617485213",
      time: "ช่วง 07.00-15.00",
    },
    {
      name: "คุณโก้",
      phone: "0657329919",
      time: "ช่วง 16.00-02.00",
    },
  ],
  messengerUrl: "https://www.facebook.com/baanpoolvillas",
  lineId: "@baanpoolvilla",
  lineUrl: "https://line.me/R/ti/p/@baanpoolvilla",
};

export const DEFAULT_SITE_SEO_SETTINGS: SiteSeoSettings = {
  title: defaultTitle,
  description: defaultDescription,
  ogImage: {
    path: defaultOgImage,
    url: defaultOgImage,
    alt: "Pool Villa บ้านพูลวิลล่า พัทยา",
  },
  businessName: siteName,
  sameAsUrls: [
    DEFAULT_SITE_CONTACT_SETTINGS.messengerUrl,
    DEFAULT_SITE_CONTACT_SETTINGS.lineUrl,
  ],
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: "Pool Villas Pattaya",
  primaryColor: "#064e3b",
  accentColor: "#eab308",
  logoImage: {
    path: "/images/logo.jpg",
    url: "/images/logo.jpg",
    alt: "Baan Pool Villa logo",
  },
  heroImage: {
    path: "/images/BPV-66_Cover-Web.jpg",
    url: "/images/BPV-66_Cover-Web.jpg",
    alt: "Pool Villa บ้านพูลวิลล่า พัทยา",
  },
  bank: DEFAULT_SITE_BANK_SETTINGS,
  contact: DEFAULT_SITE_CONTACT_SETTINGS,
  seo: DEFAULT_SITE_SEO_SETTINGS,
};
