import "server-only";

export const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const TURNSTILE_MISSING_CONFIG_MESSAGE = "Turnstile is not configured.";
const TURNSTILE_MISSING_TOKEN_MESSAGE = "Missing Turnstile token.";
const TURNSTILE_FAILED_MESSAGE = "Turnstile verification failed.";
const TURNSTILE_UNAVAILABLE_MESSAGE = "Turnstile verification is unavailable.";
const TURNSTILE_DEVELOPMENT_BYPASS_WARNING =
  "Turnstile verification is bypassed in development because keys are missing.";

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
  success?: boolean;
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

export function resetTurnstileWarningForTests() {
  hasWarnedAboutDevelopmentBypass = false;
}

export function getTurnstileConfig(): TurnstileConfig {
  const siteKey = getOptionalEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  const secretKey = getOptionalEnv("TURNSTILE_SECRET_KEY");
  const isDevelopment = process.env.NODE_ENV === "development";
  const isConfigured = siteKey !== null && secretKey !== null;

  return {
    isConfigured,
    isDevelopment,
    secretKey,
    shouldBypass: isDevelopment && !isConfigured,
    siteKey,
  };
}

export function getTurnstileClientIp(request: Request): string | null {
  const cloudflareIp = request.headers.get("CF-Connecting-IP")?.trim();

  if (cloudflareIp) {
    return cloudflareIp;
  }

  const forwardedFor = request.headers.get("X-Forwarded-For");
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();

  return firstForwardedIp ? firstForwardedIp : null;
}

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
