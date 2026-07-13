import { buildSiteThemeStylesheetHref } from "@/lib/site-settings/colors";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import type { SiteSettings } from "@/lib/site-settings/types";

import { translateAdminErrorMessage } from "@/components/admin/admin-error-messages";
import {
  extractAdminErrors,
  readJsonPayload,
  shouldRedirectToLogin,
} from "@/components/admin/admin-api-client";
import type {
  AdminSettingsDraft,
  AdminSiteSettingsResponse,
  BrandSettingsDraft,
  HeroSettingsDraft,
  ThemeSettingsDraft,
} from "./types";

const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i;

export function getSafePreviewImageUrl(value: string, fallback: string): string {
  const trimmedValue = value.trim();
  if (trimmedValue.startsWith("/") && !trimmedValue.startsWith("//")) return trimmedValue;
  try {
    const url = new URL(trimmedValue);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function getFileSnapshot(file: File | null): string | null {
  return file
    ? `${file.name}:${file.size}:${file.lastModified}:${file.type}`
    : null;
}

export function isHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value.trim());
}

function readDraftHexColor(value: string, fallback: string): string {
  const normalizedColor = value.trim().toLowerCase();

  return isHexColor(normalizedColor) ? normalizedColor : fallback;
}

// Keep the preview renderable while the form is mid-edit by falling back to
// the public site defaults whenever the draft still contains an invalid hex
// value.
export function buildDraftThemeStylesheetHref(
  draft: ThemeSettingsDraft,
  scope = "settings-preview-theme",
) {
  return buildSiteThemeStylesheetHref({
    accentColor: readDraftHexColor(
      draft.accentColor,
      DEFAULT_SITE_SETTINGS.accentColor,
    ),
    bankHighlightColor: readDraftHexColor(
      draft.bankHighlightColor,
      DEFAULT_SITE_SETTINGS.bankHighlightColor,
    ),
    bankAccountHighlightColor: readDraftHexColor(
      draft.bankAccountHighlightColor,
      DEFAULT_SITE_SETTINGS.bankAccountHighlightColor,
    ),
    bankNameHighlightColor: readDraftHexColor(
      draft.bankNameHighlightColor,
      DEFAULT_SITE_SETTINGS.bankNameHighlightColor,
    ),
    bankNumberHighlightColor: readDraftHexColor(
      draft.bankNumberHighlightColor,
      DEFAULT_SITE_SETTINGS.bankNumberHighlightColor,
    ),
    footerLinkColor: readDraftHexColor(
      draft.footerLinkColor,
      DEFAULT_SITE_SETTINGS.footerLinkColor,
    ),
    footerLinkHoverColor: readDraftHexColor(
      draft.footerLinkHoverColor,
      DEFAULT_SITE_SETTINGS.footerLinkHoverColor,
    ),
    headerLinkColor: readDraftHexColor(
      draft.headerLinkColor,
      DEFAULT_SITE_SETTINGS.headerLinkColor,
    ),
    headerLinkHoverColor: readDraftHexColor(
      draft.headerLinkHoverColor,
      DEFAULT_SITE_SETTINGS.headerLinkHoverColor,
    ),
    primaryColor: readDraftHexColor(
      draft.primaryColor,
      DEFAULT_SITE_SETTINGS.primaryColor,
    ),
  }, scope);
}

export function mapBrandSettingsResponse(value: unknown): BrandSettingsDraft {
  const settings = (value as { settings: Omit<BrandSettingsDraft, "logoFile" | "faviconFile"> }).settings;
  return { ...settings, faviconFile: null, logoFile: null };
}

export function makeBrandSettingsSnapshot(draft: BrandSettingsDraft): string {
  return JSON.stringify({
    faviconFile: getFileSnapshot(draft.faviconFile),
    logoBackground: draft.logoBackground,
    logoFile: getFileSnapshot(draft.logoFile),
    siteName: draft.siteName,
  });
}

export function buildBrandSettingsFormData(draft: BrandSettingsDraft): FormData {
  const body = new FormData();
  body.set("siteName", draft.siteName);
  body.set("logoBackground", draft.logoBackground);
  if (draft.logoFile) body.set("logo", draft.logoFile);
  if (draft.faviconFile) body.set("faviconFile", draft.faviconFile);
  return body;
}

export function mapThemeSettingsResponse(value: unknown): ThemeSettingsDraft {
  return (value as { settings: ThemeSettingsDraft }).settings;
}

export function makeThemeSettingsSnapshot(draft: ThemeSettingsDraft): string {
  return JSON.stringify(draft);
}

export function buildThemeSettingsJson(draft: ThemeSettingsDraft): string {
  return JSON.stringify(draft);
}

export function mapHeroSettingsResponse(value: unknown): HeroSettingsDraft {
  const { heroImage } = (value as { settings: { heroImage: HeroSettingsDraft["heroImage"] } }).settings;
  return { heroFile: null, heroImage, heroImageAlt: heroImage.alt };
}

export function makeHeroSettingsSnapshot(draft: HeroSettingsDraft): string {
  return JSON.stringify({
    heroFile: getFileSnapshot(draft.heroFile),
    heroImageAlt: draft.heroImageAlt,
  });
}

export function buildHeroSettingsFormData(draft: HeroSettingsDraft): FormData {
  const body = new FormData();
  body.set("heroImageAlt", draft.heroImageAlt);
  if (draft.heroFile) body.set("hero", draft.heroFile);
  return body;
}

export function mapSettingsToDraft(settings: SiteSettings): AdminSettingsDraft {
  return {
    accentColor: settings.accentColor,
    bankHighlightColor: settings.bankHighlightColor,
    bankAccountHighlightColor: settings.bankAccountHighlightColor,
    bankNameHighlightColor: settings.bankNameHighlightColor,
    bankNumberHighlightColor: settings.bankNumberHighlightColor,
    bankAccountName: settings.bank.accountName,
    bankAccountNumber: settings.bank.accountNumber,
    bankName: settings.bank.bankName,
    footerLinkColor: settings.footerLinkColor,
    footerLinkHoverColor: settings.footerLinkHoverColor,
    headerLinkColor: settings.headerLinkColor,
    headerLinkHoverColor: settings.headerLinkHoverColor,
    logoBackground: settings.logoBackground,
    villaCardStyle: settings.villaCardStyle,
    faviconFile: null,
    heroFile: null,
    heroImageAlt: settings.heroImage.alt,
    lineId: settings.contact.lineId,
    lineUrl: settings.contact.lineUrl,
    logoFile: null,
    messengerUrl: settings.contact.messengerUrl,
    phoneContacts: settings.contact.phoneContacts.map((contact) => ({
      ...contact,
    })),
    primaryColor: settings.primaryColor,
    seoBusinessName: settings.seo.businessName,
    seoDescription: settings.seo.description,
    seoOgImageFile: null,
    seoKeywords: [...settings.seo.keywords],
    seoOgImageAlt: settings.seo.ogImage.alt,
    seoOgImageUrl: settings.seo.ogImage.url,
    seoSameAsUrls: [...settings.seo.sameAsUrls],
    searchSeoTitle: settings.pageSeo.search.title,
    searchSeoDescription: settings.pageSeo.search.description,
    searchSeoOgImageFile: null,
    searchSeoKeywords: [...settings.pageSeo.search.keywords],
    searchSeoOgImageUrl: settings.pageSeo.search.ogImage.url,
    searchSeoOgImageAlt: settings.pageSeo.search.ogImage.alt,
    guidesSeoTitle: settings.pageSeo.guides.title,
    guidesSeoDescription: settings.pageSeo.guides.description,
    guidesSeoOgImageFile: null,
    guidesSeoKeywords: [...settings.pageSeo.guides.keywords],
    guidesSeoOgImageUrl: settings.pageSeo.guides.ogImage.url,
    guidesSeoOgImageAlt: settings.pageSeo.guides.ogImage.alt,
    villaDetailSeoKeywords: [...settings.pageSeo.villaDetail.keywords],
    seoTitle: settings.seo.title,
    siteName: settings.siteName,
  };
}

export function makeSettingsSnapshot(draft: AdminSettingsDraft): string {
  return JSON.stringify({
    accentColor: draft.accentColor,
    bankHighlightColor: draft.bankHighlightColor,
    bankAccountHighlightColor: draft.bankAccountHighlightColor,
    bankNameHighlightColor: draft.bankNameHighlightColor,
    bankNumberHighlightColor: draft.bankNumberHighlightColor,
    bankAccountName: draft.bankAccountName,
    bankAccountNumber: draft.bankAccountNumber,
    bankName: draft.bankName,
    footerLinkColor: draft.footerLinkColor,
    footerLinkHoverColor: draft.footerLinkHoverColor,
    headerLinkColor: draft.headerLinkColor,
    headerLinkHoverColor: draft.headerLinkHoverColor,
    logoBackground: draft.logoBackground,
    villaCardStyle: draft.villaCardStyle,
    faviconFile: getFileSnapshot(draft.faviconFile),
    heroFile: getFileSnapshot(draft.heroFile),
    heroImageAlt: draft.heroImageAlt,
    lineId: draft.lineId,
    lineUrl: draft.lineUrl,
    logoFile: getFileSnapshot(draft.logoFile),
    messengerUrl: draft.messengerUrl,
    phoneContacts: draft.phoneContacts,
    primaryColor: draft.primaryColor,
    seoBusinessName: draft.seoBusinessName,
    seoDescription: draft.seoDescription,
    seoOgImageFile: getFileSnapshot(draft.seoOgImageFile),
    seoKeywords: draft.seoKeywords,
    seoOgImageAlt: draft.seoOgImageAlt,
    seoOgImageUrl: draft.seoOgImageUrl,
    seoSameAsUrls: draft.seoSameAsUrls,
    searchSeoTitle: draft.searchSeoTitle,
    searchSeoDescription: draft.searchSeoDescription,
    searchSeoOgImageFile: getFileSnapshot(draft.searchSeoOgImageFile),
    searchSeoKeywords: draft.searchSeoKeywords,
    searchSeoOgImageUrl: draft.searchSeoOgImageUrl,
    searchSeoOgImageAlt: draft.searchSeoOgImageAlt,
    guidesSeoTitle: draft.guidesSeoTitle,
    guidesSeoDescription: draft.guidesSeoDescription,
    guidesSeoOgImageFile: getFileSnapshot(draft.guidesSeoOgImageFile),
    guidesSeoKeywords: draft.guidesSeoKeywords,
    guidesSeoOgImageUrl: draft.guidesSeoOgImageUrl,
    guidesSeoOgImageAlt: draft.guidesSeoOgImageAlt,
    villaDetailSeoKeywords: draft.villaDetailSeoKeywords,
    seoTitle: draft.seoTitle,
    siteName: draft.siteName,
  });
}

export function buildSettingsFormData(draft: AdminSettingsDraft): FormData {
  const formData = new FormData();

  formData.set("siteName", draft.siteName);
  formData.set("primaryColor", draft.primaryColor);
  formData.set("accentColor", draft.accentColor);
  formData.set("headerLinkColor", draft.headerLinkColor);
  formData.set("headerLinkHoverColor", draft.headerLinkHoverColor);
  formData.set("footerLinkColor", draft.footerLinkColor);
  formData.set("footerLinkHoverColor", draft.footerLinkHoverColor);
  formData.set("bankHighlightColor", draft.bankHighlightColor);
  formData.set("bankAccountHighlightColor", draft.bankAccountHighlightColor);
  formData.set("bankNameHighlightColor", draft.bankNameHighlightColor);
  formData.set("bankNumberHighlightColor", draft.bankNumberHighlightColor);
  formData.set("logoBackground", draft.logoBackground);
  formData.set("villaCardStyle", draft.villaCardStyle);
  formData.set("heroImageAlt", draft.heroImageAlt);
  formData.set("bankAccountName", draft.bankAccountName);
  formData.set("bankName", draft.bankName);
  formData.set("bankAccountNumber", draft.bankAccountNumber);
  formData.set("phoneContacts", JSON.stringify(draft.phoneContacts));
  formData.set("messengerUrl", draft.messengerUrl);
  formData.set("lineId", draft.lineId);
  formData.set("lineUrl", draft.lineUrl);
  formData.set("seoTitle", draft.seoTitle);
  formData.set("seoDescription", draft.seoDescription);
  formData.set("seoKeywords", JSON.stringify(draft.seoKeywords));
  formData.set("seoOgImageUrl", draft.seoOgImageUrl);
  formData.set("seoOgImageAlt", draft.seoOgImageAlt);
  formData.set("seoBusinessName", draft.seoBusinessName);
  formData.set("seoSameAsUrls", JSON.stringify(draft.seoSameAsUrls));
  formData.set("searchSeoTitle", draft.searchSeoTitle);
  formData.set("searchSeoDescription", draft.searchSeoDescription);
  formData.set("searchSeoKeywords", JSON.stringify(draft.searchSeoKeywords));
  formData.set("searchSeoOgImageUrl", draft.searchSeoOgImageUrl);
  formData.set("searchSeoOgImageAlt", draft.searchSeoOgImageAlt);
  formData.set("guidesSeoTitle", draft.guidesSeoTitle);
  formData.set("guidesSeoDescription", draft.guidesSeoDescription);
  formData.set("guidesSeoKeywords", JSON.stringify(draft.guidesSeoKeywords));
  formData.set("guidesSeoOgImageUrl", draft.guidesSeoOgImageUrl);
  formData.set("guidesSeoOgImageAlt", draft.guidesSeoOgImageAlt);
  formData.set("villaDetailSeoKeywords", JSON.stringify(draft.villaDetailSeoKeywords));

  if (draft.logoFile) {
    formData.set("logo", draft.logoFile);
  }

  if (draft.faviconFile) {
    formData.set("faviconFile", draft.faviconFile);
  }

  if (draft.heroFile) {
    formData.set("hero", draft.heroFile);
  }

  if (draft.seoOgImageFile) {
    formData.set("seoOgImageFile", draft.seoOgImageFile);
  }

  if (draft.searchSeoOgImageFile) {
    formData.set("searchSeoOgImageFile", draft.searchSeoOgImageFile);
  }

  if (draft.guidesSeoOgImageFile) {
    formData.set("guidesSeoOgImageFile", draft.guidesSeoOgImageFile);
  }

  return formData;
}

export function extractErrors(
  payload: unknown,
  fallback: string,
): string[] {
  const errors = extractAdminErrors(payload, fallback);
  const errorPayload =
    payload && typeof payload === "object"
      ? (payload as AdminSiteSettingsResponse)
      : null;

  if (
    typeof errorPayload?.error === "string" &&
    errorPayload.error &&
    typeof errorPayload.warning === "string" &&
    errorPayload.warning
  ) {
    return [
      ...errors,
      `คำเตือน: ${translateAdminErrorMessage(errorPayload.warning)}`,
    ];
  }

  return errors;
}

export function extractWarnings(payload: AdminSiteSettingsResponse): string[] {
  const warnings = Array.isArray(payload.warnings)
    ? payload.warnings.filter(
        (warning): warning is string =>
          typeof warning === "string" && warning.length > 0,
      )
    : [];

  if (typeof payload.warning === "string" && payload.warning) {
    return [...warnings, payload.warning].map(translateAdminErrorMessage);
  }

  return warnings.map(translateAdminErrorMessage);
}

export { readJsonPayload, shouldRedirectToLogin };
