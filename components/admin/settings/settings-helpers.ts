import { buildSiteThemeStyle } from "@/lib/site-settings/colors";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import type { SiteSettings } from "@/lib/site-settings/types";
import type { SiteContactSettings } from "@/lib/site-contact-settings/types";

import { translateAdminErrorMessage } from "@/components/admin/admin-error-messages";
import {
  extractAdminErrors,
  readJsonPayload,
  shouldRedirectToLogin,
} from "@/components/admin/admin-api-client";
import type {
  AdminSiteSettingsResponse,
  BrandSettingsDraft,
  HeroSettingsDraft,
  ContactSettingsDraft,
  SeoSettingsDraft,
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
export function buildDraftThemeStyle(draft: ThemeSettingsDraft) {
  return buildSiteThemeStyle({
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
  });
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

export function parseDelimitedValues(value: string): string[] {
  return value.replaceAll("\r\n", "\n").replaceAll("\r", "\n").replaceAll("\n", ",").split(",").map((item) => item.trim()).filter(Boolean);
}

export function formatDelimitedValues(values: string[]): string { return values.join(","); }

export function mapSeoSettingsResponse(value: unknown): SeoSettingsDraft {
  const { seo, pageSeo } = (value as { settings: Pick<SiteSettings, "seo" | "pageSeo"> }).settings;
  return { seo, pageSeo, seoTitle: seo.title, seoDescription: seo.description, seoKeywords: [...seo.keywords], seoOgImageUrl: seo.ogImage.url, seoOgImageAlt: seo.ogImage.alt, seoBusinessName: seo.businessName, seoSameAsUrls: [...seo.sameAsUrls], searchSeoTitle: pageSeo.search.title, searchSeoDescription: pageSeo.search.description, searchSeoKeywords: [...pageSeo.search.keywords], searchSeoOgImageUrl: pageSeo.search.ogImage.url, searchSeoOgImageAlt: pageSeo.search.ogImage.alt, guidesSeoTitle: pageSeo.guides.title, guidesSeoDescription: pageSeo.guides.description, guidesSeoKeywords: [...pageSeo.guides.keywords], guidesSeoOgImageUrl: pageSeo.guides.ogImage.url, guidesSeoOgImageAlt: pageSeo.guides.ogImage.alt, villaDetailSeoKeywords: [...pageSeo.villaDetail.keywords], seoOgImageFile: null, searchSeoOgImageFile: null, guidesSeoOgImageFile: null };
}

export function makeSeoSettingsSnapshot(draft: SeoSettingsDraft): string {
  return JSON.stringify({ ...draft, seo: undefined, pageSeo: undefined, seoOgImageFile: getFileSnapshot(draft.seoOgImageFile), searchSeoOgImageFile: getFileSnapshot(draft.searchSeoOgImageFile), guidesSeoOgImageFile: getFileSnapshot(draft.guidesSeoOgImageFile) });
}

export function buildSeoSettingsFormData(draft: SeoSettingsDraft): FormData {
  const body = new FormData();
  for (const key of ["seoTitle", "seoDescription", "seoOgImageUrl", "seoOgImageAlt", "seoBusinessName", "searchSeoTitle", "searchSeoDescription", "searchSeoOgImageUrl", "searchSeoOgImageAlt", "guidesSeoTitle", "guidesSeoDescription", "guidesSeoOgImageUrl", "guidesSeoOgImageAlt"] as const) body.set(key, draft[key]);
  for (const key of ["seoKeywords", "seoSameAsUrls", "searchSeoKeywords", "guidesSeoKeywords", "villaDetailSeoKeywords"] as const) body.set(key, JSON.stringify(draft[key]));
  if (draft.seoOgImageFile) body.set("seoOgImageFile", draft.seoOgImageFile);
  if (draft.searchSeoOgImageFile) body.set("searchSeoOgImageFile", draft.searchSeoOgImageFile);
  if (draft.guidesSeoOgImageFile) body.set("guidesSeoOgImageFile", draft.guidesSeoOgImageFile);
  return body;
}

export function mapContactSettingsResponse(value: unknown): ContactSettingsDraft {
  const { bank, contact } = (value as { settings: SiteContactSettings }).settings;
  return { bankAccountName: bank.accountName, bankName: bank.bankName, bankAccountNumber: bank.accountNumber, phoneContacts: contact.phoneContacts.map((item) => ({ ...item })), messengerUrl: contact.messengerUrl, lineId: contact.lineId, lineUrl: contact.lineUrl };
}

export function makeContactSettingsSnapshot(draft: ContactSettingsDraft): string { return JSON.stringify(draft); }
export function buildContactSettingsJson(draft: ContactSettingsDraft): string { return JSON.stringify(draft); }
export function addPhoneContact(contacts: ContactSettingsDraft["phoneContacts"]) { return [...contacts, { name: "", phone: "", time: "" }]; }
export function updatePhoneContact(contacts: ContactSettingsDraft["phoneContacts"], index: number, changes: Partial<ContactSettingsDraft["phoneContacts"][number]>) { return contacts.map((contact, contactIndex) => contactIndex === index ? { ...contact, ...changes } : contact); }
export function removePhoneContact(contacts: ContactSettingsDraft["phoneContacts"], index: number) { return contacts.length <= 1 ? contacts : contacts.filter((_contact, contactIndex) => contactIndex !== index); }

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
