import type { SiteSettings } from "./types";

export const SITE_SETTINGS_ID = "global";
export const SITE_ASSETS_BUCKET = "site-assets";
export const SITE_SETTINGS_UPLOAD_LIMIT_BYTES = 6 * 1024 * 1024;

export const SITE_SETTINGS_ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

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
};
