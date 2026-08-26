import { translateAdminErrorMessage } from "@/components/admin/admin-error-messages";
import { extractAdminErrors } from "@/components/admin/admin-api-client";
import type {
  AdminTikTokDraft,
  AdminTikTokResponse,
  AdminTikTokSettings,
  AdminTikTokVideoDraft,
} from "./types";

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
  videos: [],
};

export const HOMEPAGE_TIKTOK_PREVIEW_LIMIT = 15;

export const HOMEPAGE_TIKTOK_NOTICE =
  "หน้าหลักจะแสดงเฉพาะ 15 วิดีโอแรกจากที่บันทึกเท่านั้น";

export function mapTikTokSettingsToDraft(
  settings: AdminTikTokSettings,
): AdminTikTokDraft {
  return {
    accountUrl: settings.accountUrl,
    videos: settings.videos.map((video, index) => ({
      houseId: video.houseId,
      id: createStableTikTokRowId(video.url, index),
      url: video.url,
      villaTitle: video.villaTitle ?? null,
    })),
  };
}

export function makeTikTokSnapshot(draft: AdminTikTokDraft): string {
  return JSON.stringify({
    accountUrl: draft.accountUrl,
    videos: draft.videos.map((video) => ({
      houseId: video.houseId,
      url: video.url,
    })),
  });
}

export function buildTikTokFormData(draft: AdminTikTokDraft): FormData {
  const formData = new FormData();

  formData.set("tiktokAccountUrl", draft.accountUrl);
  formData.set(
    "tiktokVideoUrls",
    JSON.stringify(
      draft.videos.map((video) => ({
        houseId: video.houseId,
        url: video.url,
      })),
    ),
  );

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
  return extractAdminErrors(payload, fallback);
}

// Treat rich 403 payloads as inline save errors, not forced logout signals.
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

  if (
    typeof payload?.code === "string" ||
    typeof payload?.details === "string" ||
    typeof payload?.hint === "string" ||
    (typeof message === "string" &&
      (message.includes("code:") ||
        message.includes("details:") ||
        message.includes("hint:")))
  ) {
    return false;
  }

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
    return [...warnings, typedPayload.warning].map(translateAdminErrorMessage);
  }

  return warnings.map(translateAdminErrorMessage);
}

export function makePreviewVideoRows(
  videos: AdminTikTokVideoDraft[],
): AdminTikTokVideoDraft[] {
  if (videos.length === 0) {
    return [
      { houseId: null, id: "tiktok-empty-row", url: "", villaTitle: null },
    ];
  }

  return videos;
}

export function getVisibleTikTokVideoCount(
  videos: Array<Pick<AdminTikTokVideoDraft, "url"> | string>,
): number {
  return Math.min(
    HOMEPAGE_TIKTOK_PREVIEW_LIMIT,
    videos.filter((video) => (typeof video === "string" ? video : video.url).trim().length > 0)
      .length,
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
