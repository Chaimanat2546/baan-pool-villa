import {
  getBookingCalendarAccessDecision,
  getBookingCalendarRequestTarget,
} from "./worker-cache-policy.js";
import {
  createBookingCalendarHmacIdentifier,
  createBookingCalendarToken,
  verifyBookingCalendarToken,
} from "./worker-calendar-token.js";

const CALENDAR_CLIENT_MARKER_HEADER = "X-BPV-Calendar";
const CALENDAR_TOKEN_HEADER = "X-BPV-Calendar-Token";
const RATE_LIMIT_RETRY_SECONDS = 60;
const MINIMUM_SECRET_LENGTH = 32;

function noStoreJson(body, status, extraHeaders = {}) {
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
    status,
  });
}

function forbiddenResponse() {
  return noStoreJson({ error: "Forbidden." }, 403);
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

function methodNotAllowedResponse(allowedMethod) {
  return noStoreJson(
    { error: "Method not allowed." },
    405,
    { Allow: allowedMethod },
  );
}

function hasRateLimiter(binding) {
  return binding && typeof binding.limit === "function";
}

function hasValidEnvironment(env) {
  return (
    typeof env?.CALENDAR_ACCESS_SECRET === "string" &&
    env.CALENDAR_ACCESS_SECRET.length >= MINIMUM_SECRET_LENGTH &&
    hasRateLimiter(env.CALENDAR_TOKEN_ISSUER_RATE_LIMITER) &&
    hasRateLimiter(env.CALENDAR_TOKEN_USAGE_RATE_LIMITER) &&
    hasRateLimiter(env.CALENDAR_IP_RATE_LIMITER)
  );
}

function readRequestBinding(request) {
  const clientIp = request.headers.get("CF-Connecting-IP")?.trim() ?? "";
  const userAgent = request.headers.get("User-Agent")?.trim() ?? "";

  return clientIp && userAgent ? { clientIp, userAgent } : null;
}

async function createClientIdentifier(secret, requestBinding) {
  return createBookingCalendarHmacIdentifier({
    parts: [
      "calendar-client",
      requestBinding.clientIp,
      requestBinding.userAgent,
    ],
    secret,
  });
}

function logRejection({ clientId, reason, villaId }) {
  console.warn(
    JSON.stringify({
      clientId: clientId ? clientId.slice(0, 16) : "unavailable",
      event: "booking_calendar_access_rejected",
      reason,
      villaId,
    }),
  );
}

async function issueToken(env, villaId, requestBinding, clientId) {
  const issuerLimit = await env.CALENDAR_TOKEN_ISSUER_RATE_LIMITER.limit({
    key: clientId,
  });

  if (!issuerLimit.success) {
    logRejection({ clientId, reason: "token_issuance_rate", villaId });
    return rateLimitedResponse();
  }

  const token = await createBookingCalendarToken({
    ...requestBinding,
    secret: env.CALENDAR_ACCESS_SECRET,
    villaId,
  });

  return noStoreJson(token, 200);
}

async function validateCalendarToken(
  request,
  env,
  villaId,
  requestBinding,
  clientId,
) {
  const token = request.headers.get(CALENDAR_TOKEN_HEADER)?.trim();

  if (!token) {
    logRejection({ clientId, reason: "token_missing", villaId });
    return forbiddenResponse();
  }

  const verification = await verifyBookingCalendarToken({
    ...requestBinding,
    secret: env.CALENDAR_ACCESS_SECRET,
    token,
    villaId,
  });

  if (!verification.valid) {
    logRejection({
      clientId,
      reason: `token_${verification.reason}`,
      villaId,
    });
    return forbiddenResponse();
  }

  const tokenLimit = await env.CALENDAR_TOKEN_USAGE_RATE_LIMITER.limit({
    key: verification.tokenId,
  });

  if (!tokenLimit.success) {
    logRejection({ clientId, reason: "token_usage_rate", villaId });
    return rateLimitedResponse();
  }

  const ipLimit = await env.CALENDAR_IP_RATE_LIMITER.limit({
    key: clientId,
  });

  if (!ipLimit.success) {
    logRejection({ clientId, reason: "calendar_ip_rate", villaId });
    return rateLimitedResponse();
  }

  return null;
}

export async function handleBookingCalendarAccess(request, env) {
  const target = getBookingCalendarRequestTarget(request);

  if (!target.candidate) {
    return null;
  }

  const access = getBookingCalendarAccessDecision(
    request,
    env?.NEXT_PUBLIC_SITE_URL,
  );

  if (!access.allowed) {
    const isMissingClientMarker = access.reason === "header";

    return noStoreJson(
      { error: isMissingClientMarker ? "Forbidden." : "Not found." },
      isMissingClientMarker ? 403 : 404,
    );
  }

  const expectedMethod = target.type === "token" ? "POST" : "GET";

  if (request.method !== expectedMethod) {
    return methodNotAllowedResponse(expectedMethod);
  }

  if (!hasValidEnvironment(env)) {
    logRejection({
      clientId: null,
      reason: "configuration",
      villaId: target.villaId,
    });
    return unavailableResponse();
  }

  const requestBinding = readRequestBinding(request);

  if (!requestBinding) {
    logRejection({
      clientId: null,
      reason: "request_binding",
      villaId: target.villaId,
    });
    return forbiddenResponse();
  }

  const clientId = await createClientIdentifier(
    env.CALENDAR_ACCESS_SECRET,
    requestBinding,
  );

  if (target.type === "token") {
    return issueToken(
      env,
      target.villaId,
      requestBinding,
      clientId,
    );
  }

  return validateCalendarToken(
    request,
    env,
    target.villaId,
    requestBinding,
    clientId,
  );
}

export {
  CALENDAR_CLIENT_MARKER_HEADER,
  CALENDAR_TOKEN_HEADER,
};
