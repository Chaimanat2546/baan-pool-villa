import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleBookingCalendarAccess } from "./worker-calendar-access.js";

const secret = "calendar-access-secret-with-at-least-32-characters";
const headers = {
  "CF-Connecting-IP": "203.0.113.10",
  "User-Agent": "Calendar Browser/1.0",
  "X-BPV-Calendar": "1",
};

function createRateLimiter(success = true) {
  return {
    limit: vi.fn().mockResolvedValue({ success }),
  };
}

function createEnv() {
  return {
    CALENDAR_ACCESS_SECRET: secret,
    CALENDAR_IP_RATE_LIMITER: createRateLimiter(),
    CALENDAR_TOKEN_ISSUER_RATE_LIMITER: createRateLimiter(),
    CALENDAR_TOKEN_USAGE_RATE_LIMITER: createRateLimiter(),
    NEXT_PUBLIC_SITE_URL: "https://www.example.com",
  };
}

function tokenRequest(host = "www.example.com") {
  return new Request(
    `https://${host}/api/villas/1981/booking-calendar-token`,
    {
      headers,
      method: "POST",
    },
  );
}

function calendarRequest(token?: string) {
  return new Request(
    "https://www.example.com/api/villas/1981/booking-calendar?month=2026-07",
    {
      headers: token
        ? {
            ...headers,
            "X-BPV-Calendar-Token": token,
          }
        : headers,
    },
  );
}

async function issueToken(env = createEnv()) {
  const response = await handleBookingCalendarAccess(tokenRequest(), env);
  const body = (await response?.json()) as {
    expiresAt: number;
    token: string;
  };

  return { body, env, response };
}

function tamperToken(token: string) {
  const parts = token.split(".");
  const signature = parts[3] ?? "";

  parts[3] = `${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;

  return parts.join(".");
}

describe("booking calendar Worker access guard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("issues a no-store token after the host, marker, and issuer limit pass", async () => {
    const { body, env, response } = await issueToken();

    expect(response?.status).toBe(200);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
    expect(body.token).toMatch(/^v1\./);
    expect(body.expiresAt).toBeGreaterThan(Date.now());
    expect(env.CALENDAR_TOKEN_ISSUER_RATE_LIMITER.limit).toHaveBeenCalledOnce();
    expect(env.CALENDAR_TOKEN_USAGE_RATE_LIMITER.limit).not.toHaveBeenCalled();
    expect(env.CALENDAR_IP_RATE_LIMITER.limit).not.toHaveBeenCalled();
  });

  it("allows a valid token only after token and IP limits pass", async () => {
    const { body } = await issueToken();
    const env = createEnv();

    await expect(
      handleBookingCalendarAccess(calendarRequest(body.token), env),
    ).resolves.toBeNull();
    expect(env.CALENDAR_TOKEN_USAGE_RATE_LIMITER.limit).toHaveBeenCalledOnce();
    expect(env.CALENDAR_IP_RATE_LIMITER.limit).toHaveBeenCalledOnce();
  });

  it("rejects missing and tampered tokens before rate-limit or cache flow", async () => {
    const env = createEnv();
    const missing = await handleBookingCalendarAccess(calendarRequest(), env);
    const { body } = await issueToken();
    const tampered = await handleBookingCalendarAccess(
      calendarRequest(tamperToken(body.token)),
      env,
    );

    expect(missing?.status).toBe(403);
    expect(tampered?.status).toBe(403);
    expect(missing?.headers.get("Cache-Control")).toBe("no-store");
    expect(env.CALENDAR_TOKEN_USAGE_RATE_LIMITER.limit).not.toHaveBeenCalled();
    expect(env.CALENDAR_IP_RATE_LIMITER.limit).not.toHaveBeenCalled();
  });

  it("applies the existing exact host and marker guard to token issuance", async () => {
    const env = createEnv();
    const wrongHost = await handleBookingCalendarAccess(
      tokenRequest("cl.example.com"),
      env,
    );
    const missingMarker = await handleBookingCalendarAccess(
      new Request(
        "https://www.example.com/api/villas/1981/booking-calendar-token",
        {
          headers: {
            "CF-Connecting-IP": headers["CF-Connecting-IP"],
            "User-Agent": headers["User-Agent"],
          },
          method: "POST",
        },
      ),
      env,
    );

    expect(wrongHost?.status).toBe(404);
    expect(missingMarker?.status).toBe(403);
  });

  it("fails closed when a required secret or binding is missing", async () => {
    const missingSecret = createEnv();
    delete (missingSecret as Partial<typeof missingSecret>)
      .CALENDAR_ACCESS_SECRET;
    const missingBinding = createEnv();
    delete (missingBinding as Partial<typeof missingBinding>)
      .CALENDAR_TOKEN_ISSUER_RATE_LIMITER;

    expect(
      (await handleBookingCalendarAccess(tokenRequest(), missingSecret))?.status,
    ).toBe(503);
    expect(
      (await handleBookingCalendarAccess(tokenRequest(), missingBinding))
        ?.status,
    ).toBe(503);
  });

  it("returns 429 with Retry-After when any behavioral limit is exceeded", async () => {
    const issuerEnv = createEnv();
    issuerEnv.CALENDAR_TOKEN_ISSUER_RATE_LIMITER = createRateLimiter(false);
    const issuerBlocked = await handleBookingCalendarAccess(
      tokenRequest(),
      issuerEnv,
    );

    const { body } = await issueToken();
    const tokenEnv = createEnv();
    tokenEnv.CALENDAR_TOKEN_USAGE_RATE_LIMITER = createRateLimiter(false);
    const tokenBlocked = await handleBookingCalendarAccess(
      calendarRequest(body.token),
      tokenEnv,
    );

    expect(issuerBlocked?.status).toBe(429);
    expect(issuerBlocked?.headers.get("Retry-After")).toBe("60");
    expect(tokenBlocked?.status).toBe(429);
    expect(tokenBlocked?.headers.get("Retry-After")).toBe("60");
    expect(tokenEnv.CALENDAR_IP_RATE_LIMITER.limit).not.toHaveBeenCalled();
  });

  it("does not write a raw token or IP in rejection logs", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { body } = await issueToken();
    const env = createEnv();
    env.CALENDAR_TOKEN_USAGE_RATE_LIMITER = createRateLimiter(false);

    await handleBookingCalendarAccess(calendarRequest(body.token), env);

    const serializedLogs = JSON.stringify(consoleWarn.mock.calls);
    expect(serializedLogs).not.toContain(body.token);
    expect(serializedLogs).not.toContain(headers["CF-Connecting-IP"]);
  });
});
