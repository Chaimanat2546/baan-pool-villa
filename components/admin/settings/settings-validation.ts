import {
  validateSiteSettingsDraft,
  validateUploadMetadata,
} from "@/lib/site-settings/validation";
import type { SiteSettingsDraft } from "@/lib/site-settings/types";

import type { AdminSettingsDraft } from "./types";

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
    logoBackground: draft.logoBackground,
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
