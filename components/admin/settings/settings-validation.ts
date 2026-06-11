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
    seoOgImageUrl: draft.seoOgImageUrl,
    seoOgImageAlt: draft.seoOgImageAlt,
    seoBusinessName: draft.seoBusinessName,
    seoSameAsUrls: draft.seoSameAsUrls,
    searchSeoTitle: draft.searchSeoTitle,
    searchSeoDescription: draft.searchSeoDescription,
    searchSeoOgImageUrl: draft.searchSeoOgImageUrl,
    searchSeoOgImageAlt: draft.searchSeoOgImageAlt,
    guidesSeoTitle: draft.guidesSeoTitle,
    guidesSeoDescription: draft.guidesSeoDescription,
    guidesSeoOgImageUrl: draft.guidesSeoOgImageUrl,
    guidesSeoOgImageAlt: draft.guidesSeoOgImageAlt,
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
      ...validateUploadMetadata("logo", draft.logoFile.type, draft.logoFile.size),
    );
  }

  if (draft.heroFile) {
    errors.push(
      ...validateUploadMetadata("hero", draft.heroFile.type, draft.heroFile.size),
    );
  }

  return errors;
}
