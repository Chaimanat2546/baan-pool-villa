import {
  validateBrandSettingsValues,
  validateSeoSettingsValues,
  validateThemeSettingsValues,
  validateUploadMetadata,
} from "@/lib/site-settings/validation";
import { validateSiteContactSettingsDraft } from "@/lib/site-contact-settings/validation";
import type { BrandSettingsDraft, ContactSettingsDraft, HeroSettingsDraft, SeoSettingsDraft, ThemeSettingsDraft } from "./types";

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
  const errors: string[] = [];
  if (draft.heroSlides.length < 1 || draft.heroSlides.length > 10) errors.push("ต้องมีรูป Hero อย่างน้อย 1 และไม่เกิน 10 รูป");
  draft.heroSlides.forEach((slide, index) => {
    if (!slide.file && !slide.image.url) errors.push(`สไลด์ที่ ${index + 1} ต้องมีรูปภาพ`);
    if (!slide.image.alt.trim()) errors.push(`สไลด์ที่ ${index + 1} ต้องมีคำอธิบายรูป`);
    if (slide.image.alt.trim().length > 160) errors.push(`คำอธิบายรูปสไลด์ที่ ${index + 1} ต้องไม่เกิน 160 ตัวอักษร`);
    if (slide.file) errors.push(...validateUploadMetadata("hero", slide.file.type, slide.file.size, slide.file.name));
  });
  return errors;
}

export function validateSeoSettingsDraft(draft: SeoSettingsDraft): string[] {
  const errors = validateSeoSettingsValues(draft);
  for (const [file, type] of [[draft.seoOgImageFile, "seo-og"], [draft.searchSeoOgImageFile, "search-seo-og"], [draft.guidesSeoOgImageFile, "guides-seo-og"]] as const) if (file) errors.push(...validateUploadMetadata(type, file.type, file.size, file.name));
  return errors;
}

export function validateContactSettingsDraft(draft: ContactSettingsDraft): string[] {
  return validateSiteContactSettingsDraft(draft);
}
