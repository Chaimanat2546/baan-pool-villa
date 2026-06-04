import type { SiteTikTokSettings } from "@/lib/site-settings/types";

import type { AdminTikTokDraft, AdminTikTokResponse } from "./types";

interface ErrorPayloadParts {
  code?: unknown;
  details?: unknown;
  error?: unknown;
  errors?: unknown;
  hint?: unknown;
}

const ADMIN_ACCESS_ERROR_PREFIX = "Unable to verify admin access:";
const AUTH_FAILURE_MESSAGES = new Set([
  "Invalid or expired Supabase session. Please sign in again.",
  "Signed-in user is not listed as an active home config admin.",
]);

interface WarningPayloadParts {
  warning?: unknown;
  warnings?: unknown;
}

export const EMPTY_TIKTOK_DRAFT: AdminTikTokDraft = {
  accountUrl: "",
  videoUrls: [],
  videoRowIds: [],
};

export const HOMEPAGE_TIKTOK_PREVIEW_LIMIT = 6;

export const HOMEPAGE_TIKTOK_NOTICE =
  "หน้าหลักจะแสดงเฉพาะ 6 วิดีโอแรกจากที่บันทึกเท่านั้น";

export function mapTikTokSettingsToDraft(
  settings: SiteTikTokSettings,
): AdminTikTokDraft {
  return {
    accountUrl: settings.accountUrl,
    videoUrls: settings.videos.map((video) => video.url),
    videoRowIds: settings.videos.map((video, index) =>
      createStableTikTokRowId(video.url, index),
    ),
  };
}

export function makeTikTokSnapshot(draft: AdminTikTokDraft): string {
  return JSON.stringify({
    accountUrl: draft.accountUrl,
    videoUrls: draft.videoUrls,
  });
}

export function buildTikTokFormData(draft: AdminTikTokDraft): FormData {
  const formData = new FormData();

  formData.set("tiktokAccountUrl", draft.accountUrl);
  formData.set("tiktokVideoUrls", JSON.stringify(draft.videoUrls));

  return formData;
}

export function createStableTikTokRowId(url: string, index: number): string {
  const safeUrl = encodeURIComponent(url.trim().toLowerCase().slice(0, 48));
  return `tiktok-row-${index}-${safeUrl || "video"}`;
}

let fallbackTikTokRowIdCounter = 0;

export function createTikTokRowId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  fallbackTikTokRowIdCounter += 1;
  return `tiktok-row-fallback-${Date.now()}-${fallbackTikTokRowIdCounter}`;
}

export function extractTikTokErrors(
  payload: unknown,
  fallback: string,
): string[] {
  if (!payload || typeof payload !== "object") {
    return [fallback];
  }

  const typedPayload = payload as ErrorPayloadParts;

  if (Array.isArray(typedPayload.errors)) {
    const errors = typedPayload.errors.filter(
      (error): error is string => typeof error === "string" && error.length > 0,
    );

    if (errors.length > 0) {
      return errors;
    }
  }

  if (typeof typedPayload.error === "string" && typedPayload.error.length > 0) {
    const detailParts = [
      typeof typedPayload.code === "string" ? typedPayload.code : null,
      typeof typedPayload.details === "string" ? typedPayload.details : null,
      typeof typedPayload.hint === "string" ? typedPayload.hint : null,
    ].filter(Boolean);

    return [
      detailParts.length > 0
        ? `${typedPayload.error} (${detailParts.join(" / ")})`
        : typedPayload.error,
    ];
  }

  return [fallback];
}

export function shouldRedirectTikTokToLogin(
  status: number,
  payload: AdminTikTokResponse | null,
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
    (AUTH_FAILURE_MESSAGES.has(message) || message.startsWith(ADMIN_ACCESS_ERROR_PREFIX))
  );
}

export function extractTikTokWarnings(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const typedPayload = payload as WarningPayloadParts;

  const warnings = Array.isArray(typedPayload.warnings)
    ? typedPayload.warnings.filter(
        (warning): warning is string =>
          typeof warning === "string" && warning.length > 0,
      )
    : [];

  if (typeof typedPayload.warning === "string" && typedPayload.warning.length > 0) {
    return [...warnings, typedPayload.warning];
  }

  return warnings;
}

export function makePreviewVideoRows(
  videoUrls: string[],
  videoRowIds: string[] = [],
): Array<{ id: string; url: string }> {
  if (videoUrls.length === 0) {
    return [{ id: "tiktok-empty-row", url: "" }];
  }

  return videoUrls.map((url, index) => ({
    id: videoRowIds[index] || `tiktok-video-row-${index}`,
    url,
  }));
}

export function getVisibleTikTokVideoCount(videoUrls: string[]): number {
  return Math.min(
    HOMEPAGE_TIKTOK_PREVIEW_LIMIT,
    videoUrls.filter((url) => url.trim().length > 0).length,
  );
}

export function isValidPreviewAccountUrl(url: string): boolean {
  const trimmedUrl = url.trim();

  if (trimmedUrl.length === 0) {
    return false;
  }

  try {
    const parsed = new URL(trimmedUrl);

    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "tiktok.com" ||
        parsed.hostname === "www.tiktok.com" ||
        parsed.hostname === "m.tiktok.com")
    );
  } catch {
    return false;
  }
}
