import {
  validateBrandSettingsValues,
  validateHeroSettingsValues,
  validateSiteSettingsDraft,
  validateThemeSettingsValues,
  validateUploadMetadata,
} from "@/lib/site-settings/validation";
import type { SiteSettingsDraft } from "@/lib/site-settings/types";

import type { AdminSettingsDraft, BrandSettingsDraft, ContactSettingsDraft, HeroSettingsDraft, SeoSettingsDraft, ThemeSettingsDraft } from "./types";

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

export function validateBrandSettingsDraft(draft: BrandSettingsDraft): string[] {
  const errors = validateBrandSettingsValues(draft);
  if (draft.logoFile) errors.push(...validateUploadMetadata("logo", draft.logoFile.type, draft.logoFile.size, draft.logoFile.name));
  if (draft.faviconFile) errors.push(...validateUploadMetadata("favicon", draft.faviconFile.type, draft.faviconFile.size, draft.faviconFile.name));
  return errors;
}

export function validateThemeSettingsDraft(draft: ThemeSettingsDraft): string[] {
  return validateThemeSettingsValues(draft);
}

export function validateHeroSettingsDraft(draft: HeroSettingsDraft): string[] {
  const errors = validateHeroSettingsValues(draft);
  if (draft.heroFile) errors.push(...validateUploadMetadata("hero", draft.heroFile.type, draft.heroFile.size, draft.heroFile.name));
  return errors;
}

function isHttpUrl(value: string): boolean { try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:"; } catch { return false; } }
function isPublicImageUrl(value: string): boolean { return (value.startsWith("/") && !value.startsWith("//")) || isHttpUrl(value); }

export function validateSeoSettingsDraft(draft: SeoSettingsDraft): string[] {
  const errors: string[] = [];
  if (!draft.seoTitle.trim()) errors.push("ต้องใส่ชื่อหน้าที่แสดงบน Google");
  if (!draft.seoDescription.trim()) errors.push("ต้องใส่คำอธิบายเว็บที่แสดงบน Google");
  if (!draft.seoBusinessName.trim()) errors.push("ต้องใส่ชื่อธุรกิจสำหรับ SEO");
  for (const [url, label] of [[draft.seoOgImageUrl, "รูปตัวอย่างตอนแชร์ลิงก์"], [draft.searchSeoOgImageUrl, "รูปแชร์หน้าค้นหา"], [draft.guidesSeoOgImageUrl, "รูปแชร์หน้าบทความ"]]) if (!isPublicImageUrl(url)) errors.push(`${label}ต้องเป็น URL แบบ http, https หรือ path ภายในเว็บที่ขึ้นต้นด้วย /`);
  draft.seoSameAsUrls.forEach((url, index) => { if (!isHttpUrl(url)) errors.push(`ลิงก์โซเชียลของร้านรายการที่ ${index + 1} ต้องเป็น URL แบบ http หรือ https`); });
  for (const [file, type] of [[draft.seoOgImageFile, "seo-og"], [draft.searchSeoOgImageFile, "search-seo-og"], [draft.guidesSeoOgImageFile, "guides-seo-og"]] as const) if (file) errors.push(...validateUploadMetadata(type, file.type, file.size, file.name));
  return errors;
}

export function validateContactSettingsDraft(draft: ContactSettingsDraft): string[] {
  const errors: string[] = [];
  if (!draft.bankAccountName.trim()) errors.push("ต้องใส่ชื่อบัญชีธนาคาร");
  if (!draft.bankName.trim()) errors.push("ต้องใส่ชื่อธนาคาร");
  if (!draft.bankAccountNumber.trim()) errors.push("ต้องใส่เลขบัญชีธนาคาร");
  if (!draft.phoneContacts.length) errors.push("ต้องใส่เบอร์โทรอย่างน้อย 1 รายการ");
  draft.phoneContacts.forEach((contact, index) => { const number = index + 1; if (!contact.name.trim()) errors.push(`ต้องใส่ชื่อผู้ติดต่อคนที่ ${number}`); if (!/^0\d{9}$/.test(contact.phone.replace(/[\s-]/g, ""))) errors.push(`เบอร์โทรผู้ติดต่อคนที่ ${number} ต้องเป็นเบอร์ไทย 10 หลัก เช่น 0xxxxxxxxx`); if (!contact.time.trim()) errors.push(`ต้องใส่ช่วงเวลาผู้ติดต่อคนที่ ${number}`); });
  if (!isHttpUrl(draft.messengerUrl)) errors.push("ลิงก์ Messenger ต้องเป็น URL แบบ http หรือ https");
  if (!draft.lineId.trim()) errors.push("ต้องใส่ LINE ID");
  if (!isHttpUrl(draft.lineUrl)) errors.push("ลิงก์ LINE ต้องเป็น URL แบบ http หรือ https");
  return errors;
}
