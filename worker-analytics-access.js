export const ANALYTICS_NO_STORE = "private, no-store";
export function analyticsFailure(code, status, headers = {}) {
  return Response.json(
    { error: { code, message: code }, request_id: crypto.randomUUID() },
    { status, headers: { "Cache-Control": ANALYTICS_NO_STORE, ...headers } },
  );
}
async function sameToken(actual, expected) {
  if (
    typeof actual !== "string" ||
    typeof expected !== "string" ||
    expected.length < 32 ||
    actual.length > 512
  )
    return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all(
    [actual, expected].map((v) =>
      crypto.subtle.digest("SHA-256", encoder.encode(v)),
    ),
  );
  const left = new Uint8Array(a),
    right = new Uint8Array(b);
  let different = 0;
  for (let i = 0; i < left.length; i++) different |= left[i] ^ right[i];
  return different === 0;
}
export async function guardAnalyticsRequest(request, env, rateLimit = true) {
  const path = new URL(request.url).pathname;
  if (!path.startsWith("/api/analytics/")) return null;
  const events = path === "/api/analytics/v1/events";
  const health = path === "/api/analytics/v1/health";
  if (!events && !health && path !== "/api/analytics/v1/report")
    return analyticsFailure("NOT_FOUND", 404);
  if (request.method !== (health ? "GET" : "POST"))
    return analyticsFailure("METHOD_NOT_ALLOWED", 405, {
      Allow: health ? "GET" : "POST",
    });
  if (events) {
    if (env.ANALYTICS_ENABLED !== "true")
      return analyticsFailure("TRACKING_DISABLED", 503);
    const origins = (env.ANALYTICS_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((v) => v.trim());
    const origin = request.headers.get("origin");
    if (
      !origin ||
      !origins.includes(origin) ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      return analyticsFailure("ORIGIN_NOT_ALLOWED", 403);
  } else {
    if (
      !env.ANALYTICS_REPORT_READ_TOKEN ||
      env.ANALYTICS_REPORT_READ_TOKEN.length < 32
    )
      return analyticsFailure("STORAGE_UNAVAILABLE", 503);
    const authorization = request.headers.get("authorization");
    const actual = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;
    const oldAllowed =
      Date.parse(env.ANALYTICS_REPORT_PREVIOUS_TOKEN_EXPIRES_AT ?? "") >
      Date.now();
    if (
      !(await sameToken(actual, env.ANALYTICS_REPORT_READ_TOKEN)) &&
      !(
        oldAllowed &&
        (await sameToken(actual, env.ANALYTICS_REPORT_PREVIOUS_TOKEN))
      )
    )
      return analyticsFailure("UNAUTHORIZED", 401);
  }
  if (
    !health &&
    request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
  )
    return analyticsFailure("UNSUPPORTED_MEDIA_TYPE", 415);
  if (Number(request.headers.get("content-length")) > 16384)
    return analyticsFailure("BODY_TOO_LARGE", 413);
  if (rateLimit) {
    const limiter = events
      ? env.ANALYTICS_EVENT_RATE_LIMITER
      : env.ANALYTICS_REPORT_RATE_LIMITER;
    if (!limiter?.limit) return analyticsFailure("STORAGE_UNAVAILABLE", 503);
    try {
      const result = await limiter.limit({
        key: events
          ? (request.headers.get("cf-connecting-ip") ?? "unknown")
          : "report",
      });
      if (!result.success)
        return analyticsFailure("RATE_LIMITED", 429, { "Retry-After": "60" });
    } catch {
      return analyticsFailure("STORAGE_UNAVAILABLE", 503);
    }
  }
  return null;
}
