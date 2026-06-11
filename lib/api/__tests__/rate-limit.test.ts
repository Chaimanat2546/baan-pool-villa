import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getPublicRateLimitClientKey,
  limitPublicApiRequest,
  PUBLIC_RATE_LIMIT_POLICIES,
  resetPublicRateLimitForTests,
} from "@/lib/api/rate-limit";

function requestWithHeaders(headers: HeadersInit = {}) {
  return new Request("https://example.com/api/houses", { headers });
}

async function expectTooManyRequests(
  response: Response,
  retryAfterSeconds: number,
) {
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe(String(retryAfterSeconds));
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  await expect(response.json()).resolves.toEqual({
    error: "Too many requests.",
    retryAfterSeconds,
  });
}

describe("public API rate limit helper", () => {
  beforeEach(() => {
    resetPublicRateLimitForTests();
    vi.useRealTimers();
  });

  it("uses Cloudflare client IP before forwarded IP", () => {
    const request = requestWithHeaders({
      "CF-Connecting-IP": "203.0.113.10",
      "X-Forwarded-For": "198.51.100.20, 198.51.100.21",
    });

    expect(getPublicRateLimitClientKey(request)).toBe("203.0.113.10");
  });

  it("falls back to the first forwarded IP and then unknown", () => {
    expect(
      getPublicRateLimitClientKey(
        requestWithHeaders({
          "X-Forwarded-For": "198.51.100.20, 198.51.100.21",
        }),
      ),
    ).toBe("198.51.100.20");
    expect(getPublicRateLimitClientKey(requestWithHeaders())).toBe("unknown");
  });

  it("allows requests below the policy limit and blocks the next request", async () => {
    const limit = PUBLIC_RATE_LIMIT_POLICIES.publicDownload.limit;
    const request = requestWithHeaders({ "CF-Connecting-IP": "203.0.113.30" });

    for (let index = 0; index < limit; index += 1) {
      expect(limitPublicApiRequest(request, "publicDownload")).toBeNull();
    }

    const blocked = limitPublicApiRequest(request, "publicDownload");

    expect(blocked).toBeInstanceOf(Response);
    await expectTooManyRequests(blocked as Response, 60);
  });

  it("separates counters by policy and client", () => {
    const firstClient = requestWithHeaders({
      "CF-Connecting-IP": "203.0.113.40",
    });
    const secondClient = requestWithHeaders({
      "CF-Connecting-IP": "203.0.113.41",
    });

    for (
      let index = 0;
      index < PUBLIC_RATE_LIMIT_POLICIES.publicDownload.limit;
      index += 1
    ) {
      expect(limitPublicApiRequest(firstClient, "publicDownload")).toBeNull();
    }

    expect(limitPublicApiRequest(firstClient, "publicDownload")).toBeInstanceOf(
      Response,
    );
    expect(limitPublicApiRequest(firstClient, "publicDetail")).toBeNull();
    expect(limitPublicApiRequest(secondClient, "publicDownload")).toBeNull();
  });

  it("resets the fixed window and reports retry seconds from the current time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T00:00:00.000Z"));
    const request = requestWithHeaders({ "CF-Connecting-IP": "203.0.113.50" });

    for (
      let index = 0;
      index < PUBLIC_RATE_LIMIT_POLICIES.publicDownload.limit;
      index += 1
    ) {
      expect(limitPublicApiRequest(request, "publicDownload")).toBeNull();
    }

    vi.setSystemTime(new Date("2026-06-11T00:00:45.000Z"));
    const blocked = limitPublicApiRequest(request, "publicDownload");

    await expectTooManyRequests(blocked as Response, 15);

    vi.setSystemTime(new Date("2026-06-11T00:01:00.000Z"));
    expect(limitPublicApiRequest(request, "publicDownload")).toBeNull();
  });

  it("prunes stale buckets without blocking new requests", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T00:00:00.000Z"));

    const firstWindowRequest = requestWithHeaders({
      "CF-Connecting-IP": "203.0.113.60",
    });
    expect(limitPublicApiRequest(firstWindowRequest, "publicDownload")).toBeNull();

    vi.setSystemTime(new Date("2026-06-11T00:02:00.000Z"));
    const secondWindowRequest = requestWithHeaders({
      "CF-Connecting-IP": "203.0.113.61",
    });

    expect(
      limitPublicApiRequest(secondWindowRequest, "publicDownload"),
    ).toBeNull();
  });
});
