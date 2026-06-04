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

/**
 * Create an AdminTikTokDraft from the site's TikTok settings.
 *
 * @param settings - Source TikTok settings containing `accountUrl` and a `videos` array
 * @returns An AdminTikTokDraft with `accountUrl`, `videoUrls` (extracted from each video), and `videoRowIds` (deterministic IDs derived from each video URL and its index)
 */
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

/**
 * Create a canonical snapshot of a TikTok admin draft that includes its account URL and video URLs.
 *
 * @param draft - The admin TikTok draft to snapshot.
 * @returns A JSON string containing the draft's `accountUrl` and `videoUrls`.
 */
export function makeTikTokSnapshot(draft: AdminTikTokDraft): string {
  return JSON.stringify({
    accountUrl: draft.accountUrl,
    videoUrls: draft.videoUrls,
  });
}

/**
 * Create a FormData payload from an AdminTikTokDraft for submission.
 *
 * The resulting FormData contains the keys:
 * - `tiktokAccountUrl`: the draft's `accountUrl`
 * - `tiktokVideoUrls`: a JSON string of the draft's `videoUrls`
 *
 * @param draft - The admin TikTok draft to convert into form data
 * @returns The populated FormData ready for upload or submission
 */
export function buildTikTokFormData(draft: AdminTikTokDraft): FormData {
  const formData = new FormData();

  formData.set("tiktokAccountUrl", draft.accountUrl);
  formData.set("tiktokVideoUrls", JSON.stringify(draft.videoUrls));

  return formData;
}

/**
 * Creates a stable row id for a TikTok video using its URL and list index.
 *
 * @param url - The video URL used to derive a stable, URL-based fragment for the id.
 * @param index - The zero-based position of the video; included to ensure distinct ids for multiple entries.
 * @returns A string in the form `tiktok-row-{index}-{safeFragment}` where `safeFragment` is derived from the URL or `"video"` when the URL fragment is empty.
 */
export function createStableTikTokRowId(url: string, index: number): string {
  const safeUrl = encodeURIComponent(url.trim().toLowerCase().slice(0, 48));
  return `tiktok-row-${index}-${safeUrl || "video"}`;
}

let fallbackTikTokRowIdCounter = 0;

/**
 * Generates a unique identifier suitable for a TikTok video row.
 *
 * @returns A string id; uses `crypto.randomUUID()` when available, otherwise returns a timestamp-based fallback identifier.
 */
export function createTikTokRowId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  fallbackTikTokRowIdCounter += 1;
  return `tiktok-row-fallback-${Date.now()}-${fallbackTikTokRowIdCounter}`;
}

/**
 * Extracts one or more human-readable error messages from a response-like payload.
 *
 * Interprets `payload` as either an object with an `errors` array of strings, or an object with
 * an `error` string and optional `code`, `details`, and `hint` string fields. If `errors` contains
 * any non-empty strings those are returned. If `error` is present it is returned as a single
 * message and any of `code`, `details`, or `hint` that are strings are appended in parentheses
 * separated by " / ".
 *
 * @param payload - The response payload to inspect; may be any value.
 * @param fallback - Message to return when no usable error information is found.
 * @returns An array of extracted error messages; if none can be derived returns `[fallback]`.
 */
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

/**
 * Decides whether a TikTok admin response should trigger redirecting the user to the login page.
 *
 * @param status - HTTP response status code from the TikTok request
 * @param payload - Parsed response body which may contain an `error` message
 * @returns `true` if the status or error message indicates the user must re-authenticate, `false` otherwise
 */
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

/**
 * Extracts warning messages from a TikTok API response payload.
 *
 * The function looks for a `warnings` array and a single `warning` string on the payload,
 * filters out empty or non-string entries, and returns the collected warnings.
 *
 * @returns An array of warning messages found in `payload`; empty if none are present.
 */
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

/**
 * Creates preview row objects for the given TikTok video URLs.
 *
 * @param videoUrls - Array of video URLs to convert into preview rows. If empty, a single empty row is returned.
 * @param videoRowIds - Optional per-index IDs to use for rows; when an entry is missing or falsy, a default `tiktok-video-row-{index}` ID is used.
 * @returns An array of `{ id, url }` objects for each provided URL, or a single `{ id: "tiktok-empty-row", url: "" }` when `videoUrls` is empty.
 */
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

/**
 * Compute how many TikTok videos should be visible on the homepage.
 *
 * @param videoUrls - Array of video URL strings; entries that are empty or contain only whitespace are ignored.
 * @returns The count of non-empty URLs to display, limited to HOMEPAGE_TIKTOK_PREVIEW_LIMIT.
 */
export function getVisibleTikTokVideoCount(videoUrls: string[]): number {
  return Math.min(
    HOMEPAGE_TIKTOK_PREVIEW_LIMIT,
    videoUrls.filter((url) => url.trim().length > 0).length,
  );
}

/**
 * Determines whether a string is a valid TikTok account/preview URL using HTTPS and allowed hostnames.
 *
 * @param url - The candidate URL string to validate
 * @returns `true` if `url` is a non-empty string, parses as an HTTPS URL, and has hostname `tiktok.com`, `www.tiktok.com`, or `m.tiktok.com`; `false` otherwise.
 */
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
