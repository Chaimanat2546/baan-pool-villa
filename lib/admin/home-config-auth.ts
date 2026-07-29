import "server-only";

import { createHomeConfigClient } from "@/lib/home-sections/supabase";

type HomeConfigSupabaseClient = ReturnType<typeof createHomeConfigClient>;

type AdminAuthFailureCode =
  | "session_invalid"
  | "admin_inactive"
  | "password_change_required"
  | "credential_version_mismatch"
  | "admin_verification_failed";

type AdminCheckResult =
  | {
      ok: true;
      supabase: HomeConfigSupabaseClient;
    }
  | {
      ok: false;
      message: string;
      code: AdminAuthFailureCode;
      status: 401 | 403 | 500;
      supabaseCode?: string;
      details?: string;
      hint?: string;
    };

const BEARER_SCHEME = "bearer";
const MAX_AUTHORIZATION_HEADER_LENGTH = 8192;
const ADMIN_PROFILE_PROJECTION =
  "user_id,is_active,must_change_password,credential_version";
const SESSION_INVALID_MESSAGE =
  "Invalid or expired Supabase session. Please sign in again.";
const ADMIN_INACTIVE_MESSAGE =
  "Signed-in user is not listed as an active home config admin.";
const PASSWORD_CHANGE_REQUIRED_MESSAGE =
  "Password change is required before using admin features.";
const CREDENTIAL_VERSION_MISMATCH_MESSAGE =
  "Admin credentials have changed. Please sign in again.";
const ADMIN_VERIFICATION_FAILED_MESSAGE = "Unable to verify admin access";

/**
 * Builds a JSON error response used by shared admin route helpers.
 *
 * @param message - The primary error message to return.
 * @param status - The HTTP status code for the response.
 * @param extra - Optional extra error fields to include in the response body.
 * @returns A JSON response with the shared admin error shape.
 */
export function jsonError(
  message: string,
  status: number,
  extra?: Record<string, string | null | undefined>,
) {
  return Response.json({ error: message, ...extra }, { status });
}

function isAuthorizationSeparator(characterCode: number): boolean {
  return characterCode === 32 || characterCode === 9;
}

/**
 * Extracts a bearer token from an Authorization header when the header is
 * present and well-formed.
 *
 * @param request - The incoming request that may contain a bearer token.
 * @returns The bearer token, or `null` when the header is missing or invalid.
 */
export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");

  if (!header || header.length > MAX_AUTHORIZATION_HEADER_LENGTH) {
    return null;
  }

  const trimmedHeader = header.trim();
  let separatorIndex = -1;

  for (let index = 0; index < trimmedHeader.length; index += 1) {
    if (isAuthorizationSeparator(trimmedHeader.charCodeAt(index))) {
      separatorIndex = index;
      break;
    }
  }

  if (separatorIndex <= 0) {
    return null;
  }

  const scheme = trimmedHeader.slice(0, separatorIndex);

  if (scheme.toLowerCase() !== BEARER_SCHEME) {
    return null;
  }

  const token = trimmedHeader.slice(separatorIndex).trim();

  return token ? token : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonblankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readCredentialVersion(metadata: unknown): number | null {
  if (!isRecord(metadata)) {
    return null;
  }

  const credentialVersion = metadata.credential_version;

  return Number.isSafeInteger(credentialVersion) &&
    (credentialVersion as number) > 0
    ? (credentialVersion as number)
    : null;
}

function adminFailure(
  code: AdminAuthFailureCode,
  status: 401 | 403 | 500,
  message: string,
  metadata?: {
    supabaseCode?: string;
    details?: string;
    hint?: string;
  },
): AdminCheckResult {
  return {
    ok: false,
    message,
    code,
    status,
    ...(metadata?.supabaseCode
      ? { supabaseCode: metadata.supabaseCode }
      : {}),
    ...(metadata?.details ? { details: metadata.details } : {}),
    ...(metadata?.hint ? { hint: metadata.hint } : {}),
  };
}

function sessionInvalid(): AdminCheckResult {
  return adminFailure("session_invalid", 401, SESSION_INVALID_MESSAGE);
}

function credentialVersionMismatch(): AdminCheckResult {
  return adminFailure(
    "credential_version_mismatch",
    403,
    CREDENTIAL_VERSION_MISMATCH_MESSAGE,
  );
}

async function containAuthCall<T>(
  operation: () => Promise<T>,
): Promise<T | null> {
  try {
    return await operation();
  } catch {
    return null;
  }
}

function readVerifiedClaims(response: unknown): Record<string, unknown> | null {
  if (
    !isRecord(response) ||
    response.error !== null ||
    !isRecord(response.data) ||
    !isRecord(response.data.claims)
  ) {
    return null;
  }

  return response.data.claims;
}

function readCurrentUser(response: unknown): Record<string, unknown> | null {
  if (
    !isRecord(response) ||
    response.error !== null ||
    !isRecord(response.data) ||
    !isRecord(response.data.user)
  ) {
    return null;
  }

  return response.data.user;
}

function safeDatabaseErrorField(
  value: unknown,
  token: string,
): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  return token.length > 0 ? value.replaceAll(token, "[redacted]") : value;
}

function databaseVerificationFailure(
  error: unknown,
  token: string,
): AdminCheckResult {
  if (!isRecord(error)) {
    return adminFailure(
      "admin_verification_failed",
      500,
      `${ADMIN_VERIFICATION_FAILED_MESSAGE}.`,
    );
  }

  const errorMessage = safeDatabaseErrorField(error.message, token);
  const supabaseCode = safeDatabaseErrorField(error.code, token);
  const details = safeDatabaseErrorField(error.details, token);
  const hint = safeDatabaseErrorField(error.hint, token);

  return adminFailure(
    "admin_verification_failed",
    500,
    errorMessage
      ? `${ADMIN_VERIFICATION_FAILED_MESSAGE}: ${errorMessage}`
      : `${ADMIN_VERIFICATION_FAILED_MESSAGE}.`,
    { supabaseCode, details, hint },
  );
}

/**
 * Verifies that a Supabase session token belongs to an active home-config
 * admin and returns the request-scoped Supabase client on success.
 *
 * @param token - The bearer token from the incoming admin request.
 * @returns An auth result containing either the scoped Supabase client or an
 * admin-facing error with a stable machine-readable code.
 */
export async function assertHomeConfigAdmin(
  token: string,
): Promise<AdminCheckResult> {
  const supabase = createHomeConfigClient(token);
  const [claimsResponse, userResponse] = await Promise.all([
    containAuthCall(() => supabase.auth.getClaims(token)),
    containAuthCall(() => supabase.auth.getUser(token)),
  ]);
  const claims = readVerifiedClaims(claimsResponse);
  const user = readCurrentUser(userResponse);

  if (!claims || !user) {
    return sessionInvalid();
  }

  const subject = claims.sub;
  const userId = user.id;

  if (
    !isNonblankString(subject) ||
    !isNonblankString(userId) ||
    subject !== userId
  ) {
    return sessionInvalid();
  }

  const jwtCredentialVersion = readCredentialVersion(claims.app_metadata);
  const authCredentialVersion = readCredentialVersion(user.app_metadata);

  if (
    jwtCredentialVersion === null ||
    authCredentialVersion === null
  ) {
    return credentialVersionMismatch();
  }

  let profileResponse: unknown;

  try {
    profileResponse = await supabase
      .from("admin_users")
      .select(ADMIN_PROFILE_PROJECTION)
      .eq("user_id", userId)
      .limit(2);
  } catch {
    return databaseVerificationFailure(null, token);
  }

  if (!isRecord(profileResponse) || profileResponse.error !== null) {
    return databaseVerificationFailure(
      isRecord(profileResponse) ? profileResponse.error : null,
      token,
    );
  }

  const rows = profileResponse.data;

  if (!Array.isArray(rows) || rows.length !== 1 || !isRecord(rows[0])) {
    return adminFailure("admin_inactive", 403, ADMIN_INACTIVE_MESSAGE);
  }

  const row = rows[0];

  if (
    row.user_id !== userId ||
    typeof row.is_active !== "boolean" ||
    typeof row.must_change_password !== "boolean"
  ) {
    return adminFailure("admin_inactive", 403, ADMIN_INACTIVE_MESSAGE);
  }

  if (!row.is_active) {
    return adminFailure("admin_inactive", 403, ADMIN_INACTIVE_MESSAGE);
  }

  if (row.must_change_password) {
    return adminFailure(
      "password_change_required",
      403,
      PASSWORD_CHANGE_REQUIRED_MESSAGE,
    );
  }

  const databaseCredentialVersion = Number.isSafeInteger(
    row.credential_version,
  ) && (row.credential_version as number) > 0
    ? (row.credential_version as number)
    : null;

  if (
    databaseCredentialVersion === null ||
    jwtCredentialVersion !== authCredentialVersion ||
    jwtCredentialVersion !== databaseCredentialVersion
  ) {
    return credentialVersionMismatch();
  }

  return { ok: true, supabase };
}
