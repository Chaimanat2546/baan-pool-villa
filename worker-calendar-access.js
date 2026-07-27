import {
  getBookingCalendarAccessDecision,
} from "./worker-cache-policy.js";

const RATE_LIMIT_RETRY_SECONDS = 60;
const MINIMUM_TOKEN_LENGTH = 32;
const textEncoder = new TextEncoder();

function noStoreJson(body, status, extraHeaders = {}) {
  return Response.json(body, {
    headers: {
      "Cache-Control": "private, no-store",
      ...extraHeaders,
    },
    status,
  });
}

function notFoundResponse() {
  return noStoreJson({ error: "Not found." }, 404);
}

function unauthorizedResponse() {
  return noStoreJson(
    { error: "Unauthorized." },
    401,
    { "WWW-Authenticate": "Bearer" },
  );
}

function unavailableResponse() {
  return noStoreJson(
    { error: "Booking calendar access is unavailable." },
    503,
  );
}

function rateLimitedResponse() {
  return noStoreJson(
    {
      error: "Too many requests.",
      retryAfterSeconds: RATE_LIMIT_RETRY_SECONDS,
    },
    429,
    {
      "Retry-After": String(RATE_LIMIT_RETRY_SECONDS),
    },
  );
}

function methodNotAllowedResponse() {
  return noStoreJson(
    { error: "Method not allowed." },
    405,
    { Allow: "GET" },
  );
}

function hasRateLimiter(binding) {
  return binding && typeof binding.limit === "function";
}

function hasValidEnvironment(env) {
  return (
    typeof env?.CALENDAR_INTERNAL_API_TOKEN === "string" &&
    env.CALENDAR_INTERNAL_API_TOKEN.length >= MINIMUM_TOKEN_LENGTH &&
    hasRateLimiter(env.CALENDAR_API_RATE_LIMITER)
  );
}

function readBearerCredential(request) {
  const authorization = request.headers.get("Authorization");
  const match = authorization?.match(/^Bearer ([^\s,]+)$/u);

  return match?.[1] ?? null;
}

async function hashCredential(value) {
  return crypto.subtle.digest("SHA-256", textEncoder.encode(value));
}

async function hasValidBearerCredential(request, expected) {
  const supplied = readBearerCredential(request);

  if (!supplied) {
    return false;
  }

  const [suppliedHash, expectedHash] = await Promise.all([
    hashCredential(supplied),
    hashCredential(expected),
  ]);

  return crypto.subtle.timingSafeEqual(suppliedHash, expectedHash);
}

export async function handleBookingCalendarAccess(request, env) {
  const access = getBookingCalendarAccessDecision(
    request,
    env?.NEXT_PUBLIC_SITE_URL,
  );

  if (!access.candidate) {
    return null;
  }

  if (!access.allowed) {
    return access.reason === "config"
      ? unavailableResponse()
      : notFoundResponse();
  }

  if (request.method !== "GET") {
    return methodNotAllowedResponse();
  }

  if (!hasValidEnvironment(env)) {
    return unavailableResponse();
  }

  if (
    !(await hasValidBearerCredential(
      request,
      env.CALENDAR_INTERNAL_API_TOKEN,
    ))
  ) {
    return unauthorizedResponse();
  }

  const clientIp = request.headers.get("CF-Connecting-IP")?.trim();

  if (!clientIp) {
    return unavailableResponse();
  }

  let rateLimit;

  try {
    rateLimit = await env.CALENDAR_API_RATE_LIMITER.limit({
      key: clientIp,
    });
  } catch {
    return unavailableResponse();
  }

  return rateLimit.success ? null : rateLimitedResponse();
}
