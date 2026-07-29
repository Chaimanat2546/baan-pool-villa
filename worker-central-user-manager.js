const RATE_LIMIT_RETRY_SECONDS = 60;

const CENTRAL_USER_MANAGER_PATHS = new Set([
  "/api/internal/central-user-manager/v1/health",
  "/api/internal/central-user-manager/v1/operations",
]);

const CENTRAL_USER_MANAGER_HARDENING_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
});

export function isCentralUserManagerPath(pathname) {
  return CENTRAL_USER_MANAGER_PATHS.has(pathname);
}

function jsonResponse(body, status, extraHeaders = {}) {
  return Response.json(body, {
    headers: {
      ...CENTRAL_USER_MANAGER_HARDENING_HEADERS,
      ...extraHeaders,
    },
    status,
  });
}

function unavailableResponse() {
  return jsonResponse(
    {
      error: {
        code: "agent_unavailable",
        message: "Central User Manager Agent is unavailable.",
      },
    },
    503,
  );
}

function rateLimitedResponse() {
  return jsonResponse(
    {
      error: {
        code: "rate_limited",
        message: "Too many requests.",
      },
    },
    429,
    { "Retry-After": String(RATE_LIMIT_RETRY_SECONDS) },
  );
}

function hardenResponse(response) {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(
    CENTRAL_USER_MANAGER_HARDENING_HEADERS,
  )) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function readLimiterSuccess(value) {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }

  const descriptor = Object.getOwnPropertyDescriptor(value, "success");

  return (
    descriptor &&
    Object.hasOwn(descriptor, "value") &&
    typeof descriptor.value === "boolean"
  )
    ? descriptor.value
    : null;
}

export async function handleCentralUserManagerRequest(
  request,
  env,
  ctx,
  dispatch,
) {
  const { pathname } = new URL(request.url);

  if (!isCentralUserManagerPath(pathname)) {
    return null;
  }

  let clientIp;

  try {
    clientIp = request.headers.get("CF-Connecting-IP")?.trim();
  } catch {
    return unavailableResponse();
  }

  if (!clientIp) {
    return unavailableResponse();
  }

  let rateLimitSuccess;

  try {
    const limiter = env?.CENTRAL_USER_MANAGER_RATE_LIMITER;

    if (!limiter || typeof limiter.limit !== "function") {
      return unavailableResponse();
    }

    const rateLimit = await limiter.limit({ key: clientIp });
    rateLimitSuccess = readLimiterSuccess(rateLimit);
  } catch {
    return unavailableResponse();
  }

  if (rateLimitSuccess === null) {
    return unavailableResponse();
  }

  if (!rateLimitSuccess) {
    return rateLimitedResponse();
  }

  try {
    const response = await dispatch(request, env, ctx);

    return response instanceof Response
      ? hardenResponse(response)
      : unavailableResponse();
  } catch {
    return unavailableResponse();
  }
}
