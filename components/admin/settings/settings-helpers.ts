import { buildSiteThemeStyle } from "@/lib/site-settings/colors";
import type { SiteSettings } from "@/lib/site-settings/types";

import {
  formatAdminErrorMessage,
  translateAdminErrorMessage,
  translateAdminErrorMessages,
} from "@/components/admin/admin-error-messages";
import type {
  AdminSettingsDraft,
  AdminSiteSettingsResponse,
} from "./types";

const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i;
const ADMIN_ACCESS_ERROR_PREFIX = "Unable to verify admin access:";
const AUTH_FAILURE_MESSAGES = new Set([
  "Invalid or expired Supabase session. Please sign in again.",
  "Signed-in user is not listed as an active home config admin.",
]);

function getFileSnapshot(file: File | null): string | null {
  return file
    ? `${file.name}:${file.size}:${file.lastModified}:${file.type}`
    : null;
}

export function isHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value.trim());
}

// Keep the preview renderable while the form is mid-edit by falling back to
// safe brand colors whenever the draft still contains an invalid hex value.
export function buildDraftThemeStyle(draft: AdminSettingsDraft) {
  const accentColor = draft.accentColor.trim().toLowerCase();
  const primaryColor = draft.primaryColor.trim().toLowerCase();

  return buildSiteThemeStyle({
    accentColor: isHexColor(accentColor) ? accentColor : "#eab308",
    primaryColor: isHexColor(primaryColor) ? primaryColor : "#064e3b",
  });
}

export function mapSettingsToDraft(settings: SiteSettings): AdminSettingsDraft {
  return {
    accentColor: settings.accentColor,
    bankAccountName: settings.bank.accountName,
    bankAccountNumber: settings.bank.accountNumber,
    bankName: settings.bank.bankName,
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
    seoKeywords: [...settings.seo.keywords],
    seoOgImageAlt: settings.seo.ogImage.alt,
    seoOgImageUrl: settings.seo.ogImage.url,
    seoSameAsUrls: [...settings.seo.sameAsUrls],
    searchSeoTitle: settings.pageSeo.search.title,
    searchSeoDescription: settings.pageSeo.search.description,
    searchSeoKeywords: [...settings.pageSeo.search.keywords],
    searchSeoOgImageUrl: settings.pageSeo.search.ogImage.url,
    searchSeoOgImageAlt: settings.pageSeo.search.ogImage.alt,
    guidesSeoTitle: settings.pageSeo.guides.title,
    guidesSeoDescription: settings.pageSeo.guides.description,
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
    bankAccountName: draft.bankAccountName,
    bankAccountNumber: draft.bankAccountNumber,
    bankName: draft.bankName,
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
    seoKeywords: draft.seoKeywords,
    seoOgImageAlt: draft.seoOgImageAlt,
    seoOgImageUrl: draft.seoOgImageUrl,
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
    seoTitle: draft.seoTitle,
    siteName: draft.siteName,
  });
}

export function buildSettingsFormData(draft: AdminSettingsDraft): FormData {
  const formData = new FormData();

  formData.set("siteName", draft.siteName);
  formData.set("primaryColor", draft.primaryColor);
  formData.set("accentColor", draft.accentColor);
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

  if (draft.heroFile) {
    formData.set("hero", draft.heroFile);
  }

  return formData;
}

export function extractErrors(
  payload: unknown,
  fallback: string,
): string[] {
  if (!payload || typeof payload !== "object") {
    return [fallback];
  }

  const errorPayload = payload as AdminSiteSettingsResponse;

  if (Array.isArray(errorPayload.errors)) {
    const errors = errorPayload.errors.filter(
      (error): error is string => typeof error === "string" && error.length > 0,
    );

    if (errors.length > 0) {
      return translateAdminErrorMessages(errors);
    }
  }

  if (typeof errorPayload.error === "string" && errorPayload.error) {
    const detailParts = [
      typeof errorPayload.code === "string" ? errorPayload.code : null,
      typeof errorPayload.details === "string" ? errorPayload.details : null,
      typeof errorPayload.hint === "string" ? errorPayload.hint : null,
    ].filter((part): part is string => typeof part === "string" && part.length > 0);
    const warningPart =
      typeof errorPayload.warning === "string" && errorPayload.warning
        ? `คำเตือน: ${errorPayload.warning}`
        : null;

    return [
      formatAdminErrorMessage(errorPayload.error, detailParts),
      ...(warningPart && typeof errorPayload.warning === "string"
        ? [`คำเตือน: ${translateAdminErrorMessage(errorPayload.warning)}`]
        : []),
    ];
  }

  return [fallback];
}

export async function readJsonPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
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

// Only auth/session failures should bounce the admin back to login. Other 403
// responses still need to surface inline so the user keeps local form state.
export function shouldRedirectToLogin(
  status: number,
  payload: AdminSiteSettingsResponse | null,
): boolean {
  if (status === 401) {
    return true;
  }

  if (status !== 403) {
    return false;
  }

  const message = payload?.error;

  return (
    typeof message === "string" &&
    (AUTH_FAILURE_MESSAGES.has(message) ||
      message.startsWith(ADMIN_ACCESS_ERROR_PREFIX))
  );
}
