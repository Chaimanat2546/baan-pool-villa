import {
  validateSiteSettingsDraft,
  validateUploadMetadata,
} from "@/lib/site-settings/validation";
import type { SiteSettingsDraft } from "@/lib/site-settings/types";

import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import type { AdminSettingsDraft, BrandSettingsDraft, HeroSettingsDraft, ThemeSettingsDraft } from "./types";

function toSiteSettingsDraft(draft: AdminSettingsDraft): SiteSettingsDraft {
  return {
    siteName: draft.siteName,
    primaryColor: draft.primaryColor,
    accentColor: draft.accentColor,
    headerLinkColor: draft.headerLinkColor,
    headerLinkHoverColor: draft.headerLinkHoverColor,
    footerLinkColor: draft.footerLinkColor,
    footerLinkHoverColor: draft.footerLinkHoverColor,
    bankHighlightColor: draft.bankHighlightColor,
    bankAccountHighlightColor: draft.bankAccountHighlightColor,
    bankNameHighlightColor: draft.bankNameHighlightColor,
    bankNumberHighlightColor: draft.bankNumberHighlightColor,
    logoBackground: draft.logoBackground,
    villaCardStyle: draft.villaCardStyle,
    heroImageAlt: draft.heroImageAlt,
    bankAccountName: draft.bankAccountName,
    bankName: draft.bankName,
    bankAccountNumber: draft.bankAccountNumber,
    phoneContacts: draft.phoneContacts,
    messengerUrl: draft.messengerUrl,
    lineId: draft.lineId,
    lineUrl: draft.lineUrl,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    seoKeywords: draft.seoKeywords,
    seoOgImageUrl: draft.seoOgImageUrl,
    seoOgImageAlt: draft.seoOgImageAlt,
    seoBusinessName: draft.seoBusinessName,
    seoSameAsUrls: draft.seoSameAsUrls,
    searchSeoTitle: draft.searchSeoTitle,
    searchSeoDescription: draft.searchSeoDescription,
    searchSeoKeywords: draft.searchSeoKeywords,
    searchSeoOgImageUrl: draft.searchSeoOgImageUrl,
    searchSeoOgImageAlt: draft.searchSeoOgImageAlt,
    guidesSeoTitle: draft.guidesSeoTitle,
    guidesSeoDescription: draft.guidesSeoDescription,
    guidesSeoKeywords: draft.guidesSeoKeywords,
    guidesSeoOgImageUrl: draft.guidesSeoOgImageUrl,
    guidesSeoOgImageAlt: draft.guidesSeoOgImageAlt,
    villaDetailSeoKeywords: draft.villaDetailSeoKeywords,
    tiktokAccountUrl: "",
    tiktokVideoUrls: [],
  };
}

export function validateAdminSettingsDraftForClient(
  draft: AdminSettingsDraft,
): string[] {
  const errors = validateSiteSettingsDraft(toSiteSettingsDraft(draft));

  if (draft.logoFile) {
    errors.push(
      ...validateUploadMetadata(
        "logo",
        draft.logoFile.type,
        draft.logoFile.size,
        draft.logoFile.name,
      ),
    );
  }

  if (draft.heroFile) {
    errors.push(
      ...validateUploadMetadata(
        "hero",
        draft.heroFile.type,
        draft.heroFile.size,
        draft.heroFile.name,
      ),
    );
  }

  if (draft.seoOgImageFile) {
    errors.push(
      ...validateUploadMetadata(
        "seo-og",
        draft.seoOgImageFile.type,
        draft.seoOgImageFile.size,
        draft.seoOgImageFile.name,
      ),
    );
  }

  if (draft.searchSeoOgImageFile) {
    errors.push(
      ...validateUploadMetadata(
        "search-seo-og",
        draft.searchSeoOgImageFile.type,
        draft.searchSeoOgImageFile.size,
        draft.searchSeoOgImageFile.name,
      ),
    );
  }

  if (draft.guidesSeoOgImageFile) {
    errors.push(
      ...validateUploadMetadata(
        "guides-seo-og",
        draft.guidesSeoOgImageFile.type,
        draft.guidesSeoOgImageFile.size,
        draft.guidesSeoOgImageFile.name,
      ),
    );
  }

  return errors;
}

function defaultAdminDraft(): AdminSettingsDraft {
  return {
    accentColor: DEFAULT_SITE_SETTINGS.accentColor,
    bankAccountHighlightColor: DEFAULT_SITE_SETTINGS.bankAccountHighlightColor,
    bankAccountName: DEFAULT_SITE_SETTINGS.bank.accountName,
    bankAccountNumber: DEFAULT_SITE_SETTINGS.bank.accountNumber,
    bankHighlightColor: DEFAULT_SITE_SETTINGS.bankHighlightColor,
    bankName: DEFAULT_SITE_SETTINGS.bank.bankName,
    bankNameHighlightColor: DEFAULT_SITE_SETTINGS.bankNameHighlightColor,
    bankNumberHighlightColor: DEFAULT_SITE_SETTINGS.bankNumberHighlightColor,
    faviconFile: null, footerLinkColor: DEFAULT_SITE_SETTINGS.footerLinkColor,
    footerLinkHoverColor: DEFAULT_SITE_SETTINGS.footerLinkHoverColor,
    guidesSeoDescription: DEFAULT_SITE_SETTINGS.pageSeo.guides.description,
    guidesSeoKeywords: [...DEFAULT_SITE_SETTINGS.pageSeo.guides.keywords], guidesSeoOgImageAlt: DEFAULT_SITE_SETTINGS.pageSeo.guides.ogImage.alt,
    guidesSeoOgImageFile: null, guidesSeoOgImageUrl: DEFAULT_SITE_SETTINGS.pageSeo.guides.ogImage.url, guidesSeoTitle: DEFAULT_SITE_SETTINGS.pageSeo.guides.title,
    headerLinkColor: DEFAULT_SITE_SETTINGS.headerLinkColor, headerLinkHoverColor: DEFAULT_SITE_SETTINGS.headerLinkHoverColor,
    heroFile: null, heroImageAlt: DEFAULT_SITE_SETTINGS.heroImage.alt, lineId: DEFAULT_SITE_SETTINGS.contact.lineId, lineUrl: DEFAULT_SITE_SETTINGS.contact.lineUrl,
    logoBackground: DEFAULT_SITE_SETTINGS.logoBackground, logoFile: null, messengerUrl: DEFAULT_SITE_SETTINGS.contact.messengerUrl,
    phoneContacts: DEFAULT_SITE_SETTINGS.contact.phoneContacts, primaryColor: DEFAULT_SITE_SETTINGS.primaryColor,
    searchSeoDescription: DEFAULT_SITE_SETTINGS.pageSeo.search.description, searchSeoKeywords: [...DEFAULT_SITE_SETTINGS.pageSeo.search.keywords],
    searchSeoOgImageAlt: DEFAULT_SITE_SETTINGS.pageSeo.search.ogImage.alt, searchSeoOgImageFile: null, searchSeoOgImageUrl: DEFAULT_SITE_SETTINGS.pageSeo.search.ogImage.url,
    searchSeoTitle: DEFAULT_SITE_SETTINGS.pageSeo.search.title, seoBusinessName: DEFAULT_SITE_SETTINGS.seo.businessName,
    seoDescription: DEFAULT_SITE_SETTINGS.seo.description, seoKeywords: [...DEFAULT_SITE_SETTINGS.seo.keywords], seoOgImageAlt: DEFAULT_SITE_SETTINGS.seo.ogImage.alt,
    seoOgImageFile: null, seoOgImageUrl: DEFAULT_SITE_SETTINGS.seo.ogImage.url, seoSameAsUrls: [...DEFAULT_SITE_SETTINGS.seo.sameAsUrls],
    seoTitle: DEFAULT_SITE_SETTINGS.seo.title, siteName: DEFAULT_SITE_SETTINGS.siteName, villaCardStyle: DEFAULT_SITE_SETTINGS.villaCardStyle,
    villaDetailSeoKeywords: [...DEFAULT_SITE_SETTINGS.pageSeo.villaDetail.keywords],
  };
}

export function validateBrandSettingsDraft(draft: BrandSettingsDraft): string[] {
  return validateAdminSettingsDraftForClient({ ...defaultAdminDraft(), ...draft });
}

export function validateThemeSettingsDraft(draft: ThemeSettingsDraft): string[] {
  return validateAdminSettingsDraftForClient({ ...defaultAdminDraft(), ...draft });
}

export function validateHeroSettingsDraft(draft: HeroSettingsDraft): string[] {
  return validateAdminSettingsDraftForClient({ ...defaultAdminDraft(), heroFile: draft.heroFile, heroImageAlt: draft.heroImageAlt });
}
