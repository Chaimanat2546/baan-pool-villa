import {
  formatAdminErrorMessage,
  translateAdminErrorMessages,
} from "@/components/admin/admin-error-messages";

const ADMIN_ACCESS_ERROR_PREFIX = "Unable to verify admin access:";
const AUTH_FAILURE_MESSAGES = new Set([
  "Invalid or expired Supabase session. Please sign in again.",
  "Signed-in user is not listed as an active home config admin.",
]);

interface AdminErrorPayload {
  code?: unknown;
  details?: unknown;
  error?: unknown;
  errors?: unknown;
  hint?: unknown;
  warning?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPayloadErrorMessage(payload: unknown): unknown {
  return isRecord(payload) ? payload.error : undefined;
}

export async function readJsonPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function extractAdminErrors(
  payload: unknown,
  fallback: string,
): string[] {
  if (!isRecord(payload)) {
    return [fallback];
  }

  const errorPayload = payload as AdminErrorPayload;

  if (Array.isArray(errorPayload.errors)) {
    const errors = errorPayload.errors.filter(
      (error): error is string => typeof error === "string" && error.length > 0,
    );

    if (errors.length > 0) {
      return translateAdminErrorMessages(errors);
    }
  }

  if (typeof errorPayload.error === "string" && errorPayload.error.length > 0) {
    const detailParts = [
      typeof errorPayload.code === "string" ? errorPayload.code : null,
      typeof errorPayload.details === "string" ? errorPayload.details : null,
      typeof errorPayload.hint === "string" ? errorPayload.hint : null,
    ].filter((part): part is string => typeof part === "string" && part.length > 0);

    return [formatAdminErrorMessage(errorPayload.error, detailParts)];
  }

  return [fallback];
}

// Only auth/session failures should bounce the admin back to login. Other 403
// responses still need to surface inline so the user keeps local form state.
export function shouldRedirectToLogin(
  status: number,
  payload: unknown,
): boolean {
  if (status === 401) {
    return true;
  }

  if (status !== 403) {
    return false;
  }

  const message = getPayloadErrorMessage(payload);

  return (
    typeof message === "string" &&
    (AUTH_FAILURE_MESSAGES.has(message) ||
      message.startsWith(ADMIN_ACCESS_ERROR_PREFIX))
  );
}
