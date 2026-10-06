import { expect, it } from "vitest";
import { guardAnalyticsRequest } from "./worker-analytics-access.js";
import { createSuspiciousListingRequestEvent } from "./worker-listing-security-log.js";
it("does not log analytics request metadata through the listing security logger", () => {
  const request = new Request("https://example.com/api/analytics/v1/events", {
    method: "POST",
    headers: { "CF-Connecting-IP": "192.0.2.1", "User-Agent": "private-device", Cookie: "session=private" },
  });
  for (const response of [null, new Response(null, { status: 429 }), new Response(null, { status: 201 })]) {
    expect(createSuspiciousListingRequestEvent(request, response)).toBeNull();
  }
});
const token = "x".repeat(48);
const env = {
  ANALYTICS_ENABLED: "true",
  ANALYTICS_ALLOWED_ORIGINS: "https://example.com",
  ANALYTICS_REPORT_READ_TOKEN: token,
  ANALYTICS_EVENT_RATE_LIMITER: { limit: async () => ({ success: true }) },
  ANALYTICS_REPORT_RATE_LIMITER: { limit: async () => ({ success: true }) },
};
it("rejects cross-origin events before they can reach storage", async () => {
  const r = await guardAnalyticsRequest(
    new Request("https://example.com/api/analytics/v1/events", {
      method: "POST",
      headers: {
        origin: "https://evil.com",
        "content-type": "application/json",
      },
    }),
    env,
  );
  expect(r?.status).toBe(403);
  expect(r?.headers.get("cache-control")).toContain("no-store");
});
it("requires the site's report token without requiring a browser origin", async () => {
  const url = "https://example.com/api/analytics/v1/report";
  expect(
    (await guardAnalyticsRequest(new Request(url, { method: "POST" }), env))
      ?.status,
  ).toBe(401);
  expect(
    await guardAnalyticsRequest(
      new Request(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
      }),
      env,
    ),
  ).toBeNull();
});
it("rate limits collection independently", async () => {
  const r = await guardAnalyticsRequest(
    new Request("https://example.com/api/analytics/v1/events", {
      method: "POST",
      headers: {
        origin: "https://example.com",
        "content-type": "application/json",
      },
    }),
    {
      ...env,
      ANALYTICS_EVENT_RATE_LIMITER: { limit: async () => ({ success: false }) },
    },
  );
  expect(r?.status).toBe(429);
  expect(r?.headers.get("retry-after")).toBe("60");
});
it("does not block reports when collection is disabled", async () => {
  const r = await guardAnalyticsRequest(
    new Request("https://example.com/api/analytics/v1/health", {
      headers: { authorization: `Bearer ${token}` },
    }),
    { ...env, ANALYTICS_ENABLED: "false" },
  );
  expect(r).toBeNull();
});
