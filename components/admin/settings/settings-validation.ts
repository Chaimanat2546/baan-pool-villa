import {
  validateBrandSettingsValues,
  validateContactSettingsValues,
  validateHeroSettingsValues,
  validateSeoSettingsValues,
  validateThemeSettingsValues,
  validateUploadMetadata,
} from "@/lib/site-settings/validation";
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
  const errors = validateHeroSettingsValues(draft);
  if (draft.heroFile) errors.push(...validateUploadMetadata("hero", draft.heroFile.type, draft.heroFile.size, draft.heroFile.name));
  return errors;
}

export function validateSeoSettingsDraft(draft: SeoSettingsDraft): string[] {
  const errors = validateSeoSettingsValues(draft);
  for (const [file, type] of [[draft.seoOgImageFile, "seo-og"], [draft.searchSeoOgImageFile, "search-seo-og"], [draft.guidesSeoOgImageFile, "guides-seo-og"]] as const) if (file) errors.push(...validateUploadMetadata(type, file.type, file.size, file.name));
  return errors;
}

export function validateContactSettingsDraft(draft: ContactSettingsDraft): string[] {
  return validateContactSettingsValues(draft);
}
