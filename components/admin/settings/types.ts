import type { SiteLogoBackground } from "@/lib/site-settings/logo-background";
import type { SiteSettings } from "@/lib/site-settings/types";
import type {
  SiteContactSettings,
  SiteContactSettingsDraft,
} from "@/lib/site-contact-settings/types";

export interface BrandSettingsDraft {
  faviconFile: File | null;
  faviconImage: SiteSettings["faviconImage"];
  logoBackground: SiteLogoBackground;
  logoFile: File | null;
  logoImage: SiteSettings["logoImage"];
  siteName: string;
}

export type ThemeSettingsDraft = Pick<
  SiteSettings,
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

export interface HeroSlideDraft {
  file: File | null;
  id: string;
  image: SiteSettings["heroImage"];
}

export interface HeroSettingsDraft {
  heroSlides: HeroSlideDraft[];
}

export type SeoSettingsDraft = import("@/lib/site-settings/admin-section-contracts").SiteSettingsSectionDraftMap["seo"] & {
  seoOgImageFile: File | null;
  searchSeoOgImageFile: File | null;
  guidesSeoOgImageFile: File | null;
  seo: SiteSettings["seo"];
  pageSeo: SiteSettings["pageSeo"];
};

export type ContactSettingsDraft = SiteContactSettingsDraft;

export interface AdminSiteSettingsResponse {
  code?: string;
  details?: string;
  error?: string;
  errors?: string[];
  hint?: string;
  settings?: SiteSettings | SiteContactSettings;
  warning?: string;
  warnings?: string[];
}
