import {
  defaultDescription,
  defaultKeywords,
  defaultOgImage,
  defaultTitle,
  guidesKeywords,
  guidesDescription,
  guidesTitle,
  searchKeywords,
  searchDescription,
  searchTitle,
  siteName,
  villaDetailBaseKeywords,
} from "../seo";
import { DEFAULT_DETAIL_LAYOUT } from "../detail-layout/defaults";
import type {
  SitePageSeoSettings,
  SiteSeoSettings,
  SiteSettings,
  SiteTikTokSettings,
} from "./types";
import { DEFAULT_SITE_CONTACT_SETTINGS } from "../site-contact-settings/defaults";

export const SITE_SETTINGS_ID = "global";
export const SITE_ASSETS_BUCKET = "site-assets";
export const SITE_SETTINGS_UPLOAD_LIMIT_BYTES = 6 * 1024 * 1024;

export const SITE_SETTINGS_ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const DEFAULT_SITE_SEO_SETTINGS: SiteSeoSettings = {
  title: defaultTitle,
  description: defaultDescription,
  keywords: defaultKeywords,
  ogImage: {
    path: defaultOgImage,
    url: defaultOgImage,
    alt: "Pool Villa บ้านพูลวิลล่า พัทยา",
  },
  businessName: siteName,
  sameAsUrls: [
    DEFAULT_SITE_CONTACT_SETTINGS.contact.messengerUrl,
    DEFAULT_SITE_CONTACT_SETTINGS.contact.lineUrl,
  ],
};

export const DEFAULT_SITE_PAGE_SEO_SETTINGS: SitePageSeoSettings = {
  guides: {
    title: guidesTitle,
    description: guidesDescription,
    keywords: guidesKeywords,
    ogImage: {
      path: defaultOgImage,
      url: defaultOgImage,
      alt: "Pool Villa บ้านพูลวิลล่า พัทยา",
    },
  },
  search: {
    title: searchTitle,
    description: searchDescription,
    keywords: searchKeywords,
    ogImage: {
      path: defaultOgImage,
      url: defaultOgImage,
      alt: "Pool Villa บ้านพูลวิลล่า พัทยา",
    },
  },
  villaDetail: {
    keywords: villaDetailBaseKeywords,
  },
};

export const DEFAULT_SITE_TIKTOK_SETTINGS: SiteTikTokSettings = {
  accountUrl: "",
  videos: [],
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: "Pool Villas Pattaya",
  primaryColor: "#064e3b",
  accentColor: "#eab308",
  headerLinkColor: "#ffffff",
  headerLinkHoverColor: "#eab308",
  footerLinkColor: "#ffffff",
  footerLinkHoverColor: "#eab308",
  bankHighlightColor: "#eab308",
  bankAccountHighlightColor: "#eab308",
  bankNameHighlightColor: "#eab308",
  bankNumberHighlightColor: "#eab308",
  logoBackground: "white",
  logoImage: {
    path: "/images/logo.jpg",
    url: "/images/logo.jpg",
    alt: "Baan Pool Villa logo",
  },
  faviconImage: {
    path: "/site-icons/icon.png",
    url: "/site-icons/icon.png",
    alt: "Pool Villas Pattaya icon",
  },
  heroImage: {
    path: "/images/BPV-66_Cover-Web.jpg",
    url: "/images/BPV-66_Cover-Web.jpg",
    alt: "Pool Villa บ้านพูลวิลล่า พัทยา",
  },
  seo: DEFAULT_SITE_SEO_SETTINGS,
  pageSeo: DEFAULT_SITE_PAGE_SEO_SETTINGS,
  tiktok: DEFAULT_SITE_TIKTOK_SETTINGS,
  googleTagManagerId: "",
  detailLayout: DEFAULT_DETAIL_LAYOUT,
};
