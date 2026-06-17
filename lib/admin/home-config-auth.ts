import "server-only";

import { createHomeConfigClient } from "@/lib/home-sections/supabase";

type HomeConfigSupabaseClient = ReturnType<typeof createHomeConfigClient>;

type AdminCheckResult =
  | {
      ok: true;
      supabase: HomeConfigSupabaseClient;
    }
  | {
      ok: false;
      message: string;
      status: 401 | 403;
    };

const BEARER_SCHEME = "bearer";
const MAX_AUTHORIZATION_HEADER_LENGTH = 8192;
const ADMIN_AUTH_CACHE_TTL_MS = 30_000;
const MAX_ADMIN_AUTH_CACHE_ENTRIES = 100;

type SuccessfulAdminCheckResult = Extract<AdminCheckResult, { ok: true }>;

interface AdminAuthCacheEntry {
  expiresAt: number;
  result: SuccessfulAdminCheckResult;
}

const adminAuthCache = new Map<string, AdminAuthCacheEntry>();

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

function decodeBase64Url(value: string): string {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const paddingLength = (4 - (base64.length % 4)) % 4;

  return globalThis.atob(`${base64}${"=".repeat(paddingLength)}`);
}

function getTokenExpiresAt(token: string): number | null {
  const parts = token.split(".");

  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as {
      exp?: unknown;
    };
    const expiresAtSeconds = payload.exp;

    return typeof expiresAtSeconds === "number" &&
      Number.isFinite(expiresAtSeconds)
      ? expiresAtSeconds * 1000
      : null;
  } catch {
    return null;
  }
}

function getAdminAuthCacheExpiresAt(token: string, now: number): number {
  const tokenExpiresAt = getTokenExpiresAt(token);
  const ttlExpiresAt = now + ADMIN_AUTH_CACHE_TTL_MS;

  return tokenExpiresAt === null
    ? ttlExpiresAt
    : Math.min(ttlExpiresAt, tokenExpiresAt);
}

async function getAdminAuthCacheKey(token: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function pruneExpiredAdminAuthCache(now: number) {
  adminAuthCache.forEach((entry, key) => {
    if (entry.expiresAt <= now) {
      adminAuthCache.delete(key);
    }
  });
}

function cacheSuccessfulAdminAuth(
  key: string,
  token: string,
  result: SuccessfulAdminCheckResult,
  now: number,
) {
  const expiresAt = getAdminAuthCacheExpiresAt(token, now);

  if (expiresAt <= now) {
    return;
  }

  pruneExpiredAdminAuthCache(now);

  if (adminAuthCache.size >= MAX_ADMIN_AUTH_CACHE_ENTRIES) {
    const oldestKey = adminAuthCache.keys().next().value;

    if (typeof oldestKey === "string") {
      adminAuthCache.delete(oldestKey);
    }
  }

  adminAuthCache.set(key, { expiresAt, result });
}

/**
 * Verifies that a Supabase session token belongs to an active home-config
 * admin and returns a scoped Supabase client on success.
 *
 * @param token - The bearer token from the incoming admin request.
 * @returns An auth result containing either a ready Supabase client or an
 * admin-facing error message and status.
 */
export async function assertHomeConfigAdmin(
  token: string,
): Promise<AdminCheckResult> {
  const now = Date.now();
  const cacheKey = await getAdminAuthCacheKey(token);
  const cachedResult = adminAuthCache.get(cacheKey);

  // Cache only successful auth checks so repeated admin mutations do not keep
  // re-validating the same session on every request.
  if (cachedResult && cachedResult.expiresAt > now) {
    return cachedResult.result;
  }

  if (cachedResult) {
    adminAuthCache.delete(cacheKey);
  }

  const supabase = createHomeConfigClient(token);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData.user;

  if (userError || !user) {
    return {
      ok: false,
      message: "Invalid or expired Supabase session. Please sign in again.",
      status: 401,
    };
  }

  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1);

  if (error) {
    return {
      ok: false,
      message: `Unable to verify admin access: ${error.message}`,
      status: 403,
    };
  }

  if (!Array.isArray(data) || data.length === 0) {
    return {
      ok: false,
      message: "Signed-in user is not listed as an active home config admin.",
      status: 403,
    };
  }

  const result = { ok: true, supabase } as const;

  cacheSuccessfulAdminAuth(cacheKey, token, result, now);

  return result;
}
