import "server-only";

import { isAllowedAdminRequestOrigin } from "@/lib/admin/request-origin";

export const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const TURNSTILE_SITEVERIFY_TIMEOUT_MS = 3500;
const TURNSTILE_MISSING_CONFIG_MESSAGE = "Turnstile is not configured.";
const TURNSTILE_MISSING_TOKEN_MESSAGE = "Missing Turnstile token.";
const TURNSTILE_FAILED_MESSAGE = "Turnstile verification failed.";
const TURNSTILE_UNAVAILABLE_MESSAGE = "Turnstile verification is unavailable.";
const TURNSTILE_DEVELOPMENT_BYPASS_WARNING =
  "Turnstile verification is bypassed in development.";

let hasWarnedAboutDevelopmentBypass = false;

export interface TurnstileConfig {
  isConfigured: boolean;
  isDevelopment: boolean;
  secretKey: string | null;
  shouldBypass: boolean;
  siteKey: string | null;
}

export type TurnstileVerifyResult =
  | {
      bypassed: boolean;
      ok: true;
    }
  | {
      message: string;
      ok: false;
      status: 400 | 403 | 502 | 503;
    };

interface VerifyTurnstileTokenOptions {
  request: Request;
  token: string;
}

interface TurnstileSiteverifyPayload {
  action?: unknown;
  "error-codes"?: unknown;
  hostname?: unknown;
  success?: boolean;
}

interface TurnstileRequestBody {
  token?: unknown;
}

function getOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();

  return value ? value : null;
}

function warnDevelopmentBypassOnce() {
  if (hasWarnedAboutDevelopmentBypass) {
    return;
  }

  hasWarnedAboutDevelopmentBypass = true;
  console.warn(TURNSTILE_DEVELOPMENT_BYPASS_WARNING);
}

function isSiteverifyPayload(value: unknown): value is TurnstileSiteverifyPayload {
  return typeof value === "object" && value !== null;
}

async function readTurnstileToken(request: Request): Promise<string> {
  try {
    const body = (await request.json()) as TurnstileRequestBody;

    return typeof body.token === "string" ? body.token.trim() : "";
  } catch {
    return "";
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    headers: NO_STORE_HEADERS,
    status,
  });
}

/**
 * Resets the one-time development bypass warning for test isolation.
 *
 * @returns `void`.
 */
export function resetTurnstileWarningForTests() {
  hasWarnedAboutDevelopmentBypass = false;
}

/**
 * Reads the current Turnstile configuration from environment variables.
 *
 * @returns The resolved Turnstile config, including bypass behavior for
 * development.
 */
export function getTurnstileConfig(): TurnstileConfig {
  const siteKey = getOptionalEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  const secretKey = getOptionalEnv("TURNSTILE_SECRET_KEY");
  const isDevelopment = process.env.NODE_ENV === "development";
  const isConfigured = siteKey !== null && secretKey !== null;

  return {
    isConfigured,
    isDevelopment,
    secretKey,
    shouldBypass: isDevelopment,
    siteKey,
  };
}

/**
 * Resolves the best client IP value available for Turnstile verification.
 *
 * @param request - The incoming request that may contain forwarding headers.
 * @returns The best available client IP, or `null` when unavailable.
 */
export function getTurnstileClientIp(request: Request): string | null {
  const cloudflareIp = request.headers.get("CF-Connecting-IP")?.trim();

  if (cloudflareIp) {
    return cloudflareIp;
  }

  const forwardedFor = request.headers.get("X-Forwarded-For");
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();

  return firstForwardedIp ? firstForwardedIp : null;
}

/**
 * Verifies a Turnstile token against Cloudflare and returns a normalized auth
 * result for admin login routes.
 *
 * @param options - The request and token used for Turnstile verification.
 * @returns A normalized Turnstile verification result, including development
 * bypass behavior when enabled.
 */
export async function verifyTurnstileToken({
  request,
  token,
}: VerifyTurnstileTokenOptions): Promise<TurnstileVerifyResult> {
  const config = getTurnstileConfig();

  if (config.shouldBypass) {
    warnDevelopmentBypassOnce();
    return { bypassed: true, ok: true };
  }

  if (!config.isConfigured || !config.secretKey) {
    return {
      message: TURNSTILE_MISSING_CONFIG_MESSAGE,
      ok: false,
      status: 503,
    };
  }

  const trimmedToken = token.trim();

  if (!trimmedToken) {
    return {
      message: TURNSTILE_MISSING_TOKEN_MESSAGE,
      ok: false,
      status: 400,
    };
  }

  const body = new FormData();
  body.set("secret", config.secretKey);
  body.set("response", trimmedToken);

  const remoteIp = getTurnstileClientIp(request);

  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  try {
    const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      body,
      cache: "no-store",
      method: "POST",
      signal: AbortSignal.timeout(TURNSTILE_SITEVERIFY_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        message: TURNSTILE_UNAVAILABLE_MESSAGE,
        ok: false,
        status: 502,
      };
    }

    const payload: unknown = await response.json();

    if (isSiteverifyPayload(payload) && payload.success === true) {
      return { bypassed: false, ok: true };
    }

    if (isSiteverifyPayload(payload)) {
      const errorCodes = Array.isArray(payload["error-codes"])
        ? payload["error-codes"]
            .filter((value): value is string => typeof value === "string")
            .slice(0, 8)
            .map((value) => value.slice(0, 64))
        : [];
      const hostname =
        typeof payload.hostname === "string"
          ? payload.hostname.slice(0, 253)
          : null;
      const action =
        typeof payload.action === "string" ? payload.action.slice(0, 32) : null;

      console.warn("Turnstile Siteverify rejected a token.", {
        action,
        errorCodes,
        hostname,
      });
    }

    return {
      message: TURNSTILE_FAILED_MESSAGE,
      ok: false,
      status: 403,
    };
  } catch {
    return {
      message: TURNSTILE_UNAVAILABLE_MESSAGE,
      ok: false,
      status: 502,
    };
  }
}

export async function buildAdminLoginTurnstileResponse(request: Request) {
  if (!isAllowedAdminRequestOrigin(request)) {
    return jsonResponse({ error: "Admin request origin is not allowed." }, 403);
  }

  const token = await readTurnstileToken(request);
  const result = await verifyTurnstileToken({ request, token });

  if (!result.ok) {
    return jsonResponse({ error: result.message }, result.status);
  }

  return jsonResponse({
    bypassed: result.bypassed,
    verified: true,
  });
}
