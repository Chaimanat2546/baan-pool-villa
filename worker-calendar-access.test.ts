import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { handleBookingCalendarAccess } from "./worker-calendar-access.js";

const secret = "calendar-internal-token-with-at-least-32-characters";
const clientIp = "203.0.113.10";

function bytes(value: ArrayBuffer | ArrayBufferView) {
  return value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

const timingSafeEqual = vi.fn(
  (left: ArrayBuffer | ArrayBufferView, right: ArrayBuffer | ArrayBufferView) => {
    const leftBytes = bytes(left);
    const rightBytes = bytes(right);

    if (leftBytes.byteLength !== rightBytes.byteLength) {
      return false;
    }

    let difference = 0;

    for (let index = 0; index < leftBytes.byteLength; index += 1) {
      difference |= leftBytes[index] ^ rightBytes[index];
    }

    return difference === 0;
  },
);

beforeAll(() => {
  Object.defineProperty(globalThis.crypto.subtle, "timingSafeEqual", {
    configurable: true,
    value: timingSafeEqual,
  });
});

beforeEach(() => {
  timingSafeEqual.mockClear();
});

function createRateLimiter(allowedRequests = Number.POSITIVE_INFINITY) {
  let requestCount = 0;

  return {
    limit: vi.fn(async () => {
      requestCount += 1;

      return { success: requestCount <= allowedRequests };
    }),
  };
}

function createEnv(allowedRequests?: number) {
  return {
    CALENDAR_API_RATE_LIMITER: createRateLimiter(allowedRequests),
    CALENDAR_INTERNAL_API_TOKEN: secret,
    NEXT_PUBLIC_SITE_URL: "https://www.example.com",
  };
}

function calendarRequest({
  authorization = `Bearer ${secret}`,
  clientIpHeader = clientIp,
  host = "www.example.com",
  method = "GET",
  path = "/api/villas/1981/booking-calendar?month=2026-07",
  protocol = "https:",
}: {
  authorization?: string | null;
  clientIpHeader?: string | null;
  host?: string;
  method?: string;
  path?: string;
  protocol?: string;
} = {}) {
  const headers = new Headers();

  if (authorization !== null) {
    headers.set("Authorization", authorization);
  }

  if (clientIpHeader !== null) {
    headers.set("CF-Connecting-IP", clientIpHeader);
  }

  return new Request(`${protocol}//${host}${path}`, {
    headers,
    method,
  });
}

describe("booking calendar Worker access guard", () => {
  it.each(["www.example.com", "example.com"])(
    "allows a valid private request on the exact supported host %s",
    async (host) => {
      const env = createEnv();

      await expect(
        handleBookingCalendarAccess(calendarRequest({ host }), env),
      ).resolves.toBeNull();
      expect(env.CALENDAR_API_RATE_LIMITER.limit).toHaveBeenCalledWith({
        key: clientIp,
      });
      expect(timingSafeEqual).toHaveBeenCalled();
    },
  );

  it("returns a private no-store 404 for a sibling host before checking credentials", async () => {
    const env = createEnv();
    const response = await handleBookingCalendarAccess(
      calendarRequest({
        authorization: "Bearer leaked-sibling-value",
        host: "cl.example.com",
      }),
      env,
    );

    expect(response?.status).toBe(404);
    expect(response?.headers.get("Cache-Control")).toBe("private, no-store");
    expect(env.CALENDAR_API_RATE_LIMITER.limit).not.toHaveBeenCalled();
  });

  it("guards a malformed villa id on a sibling host before checking credentials", async () => {
    const env = createEnv();
    const response = await handleBookingCalendarAccess(
      calendarRequest({
        authorization: "Bearer leaked-sibling-value",
        host: "cl.example.com",
        path: "/api/villas/not-a-number/booking-calendar?month=2026-07",
      }),
      env,
    );

    expect(response?.status).toBe(404);
    expect(response?.headers.get("Cache-Control")).toBe("private, no-store");
    expect(timingSafeEqual).not.toHaveBeenCalled();
    expect(env.CALENDAR_API_RATE_LIMITER.limit).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when the configured public site URL is missing", async () => {
    const env = createEnv();
    delete (env as Partial<typeof env>).NEXT_PUBLIC_SITE_URL;

    const response = await handleBookingCalendarAccess(
      calendarRequest(),
      env,
    );

    expect(response?.status).toBe(503);
    expect(response?.headers.get("Cache-Control")).toBe("private, no-store");
    expect(env.CALENDAR_API_RATE_LIMITER.limit).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when the configured public site URL is not HTTPS", async () => {
    const env = createEnv();
    env.NEXT_PUBLIC_SITE_URL = "http://www.example.com";

    const response = await handleBookingCalendarAccess(
      calendarRequest({ authorization: null }),
      env,
    );

    expect(response?.status).toBe(503);
    expect(response?.headers.get("Cache-Control")).toBe("private, no-store");
    expect(timingSafeEqual).not.toHaveBeenCalled();
    expect(env.CALENDAR_API_RATE_LIMITER.limit).not.toHaveBeenCalled();
  });

  it("returns a private no-store 404 for HTTP on an official hostname before credentials", async () => {
    const env = createEnv();
    const response = await handleBookingCalendarAccess(
      calendarRequest({
        authorization: null,
        protocol: "http:",
      }),
      env,
    );

    expect(response?.status).toBe(404);
    expect(response?.headers.get("Cache-Control")).toBe("private, no-store");
    expect(timingSafeEqual).not.toHaveBeenCalled();
    expect(env.CALENDAR_API_RATE_LIMITER.limit).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null],
    ["wrong", "Bearer wrong"],
    ["malformed", `Bearer  ${secret}`],
  ])(
    "returns a private no-store 401 for a %s Bearer credential before rate limiting",
    async (_label, authorization) => {
      const env = createEnv();
      const response = await handleBookingCalendarAccess(
        calendarRequest({ authorization }),
        env,
      );

      expect(response?.status).toBe(401);
      expect(response?.headers.get("Cache-Control")).toBe("private, no-store");
      expect(response?.headers.get("WWW-Authenticate")).toBe("Bearer");
      expect(env.CALENDAR_API_RATE_LIMITER.limit).not.toHaveBeenCalled();
    },
  );

  it("returns 405 for non-GET calendar requests", async () => {
    const response = await handleBookingCalendarAccess(
      calendarRequest({ method: "POST" }),
      createEnv(),
    );

    expect(response?.status).toBe(405);
    expect(response?.headers.get("Allow")).toBe("GET");
    expect(response?.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("fails closed with 503 when the private secret is missing", async () => {
    const env = createEnv();
    delete (env as Partial<typeof env>).CALENDAR_INTERNAL_API_TOKEN;

    const response = await handleBookingCalendarAccess(
      calendarRequest(),
      env,
    );

    expect(response?.status).toBe(503);
    expect(response?.headers.get("Cache-Control")).toBe("private, no-store");
    expect(env.CALENDAR_API_RATE_LIMITER.limit).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when the rate-limit binding is missing", async () => {
    const env = createEnv();
    delete (env as Partial<typeof env>).CALENDAR_API_RATE_LIMITER;

    const response = await handleBookingCalendarAccess(
      calendarRequest(),
      env,
    );

    expect(response?.status).toBe(503);
    expect(response?.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("rejects the 61st request from one IP with 429", async () => {
    const env = createEnv(60);

    for (let requestNumber = 1; requestNumber <= 60; requestNumber += 1) {
      await expect(
        handleBookingCalendarAccess(calendarRequest(), env),
      ).resolves.toBeNull();
    }

    const blocked = await handleBookingCalendarAccess(
      calendarRequest(),
      env,
    );

    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBe("60");
    expect(blocked?.headers.get("Cache-Control")).toBe("private, no-store");
    expect(env.CALENDAR_API_RATE_LIMITER.limit).toHaveBeenCalledTimes(61);
  });

  it("fails closed with 503 when the rate-limit binding rejects", async () => {
    const env = createEnv();
    env.CALENDAR_API_RATE_LIMITER.limit.mockRejectedValueOnce(
      new Error("rate-limit unavailable"),
    );

    const response = await handleBookingCalendarAccess(
      calendarRequest(),
      env,
    );

    expect(response?.status).toBe(503);
    expect(response?.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it.each([
    ["missing", null],
    ["blank", "   "],
  ])(
    "fails closed with 503 when CF-Connecting-IP is %s",
    async (_label, clientIpHeader) => {
      const env = createEnv();
      const response = await handleBookingCalendarAccess(
        calendarRequest({ clientIpHeader }),
        env,
      );

      expect(response?.status).toBe(503);
      expect(response?.headers.get("Cache-Control")).toBe("private, no-store");
      expect(env.CALENDAR_API_RATE_LIMITER.limit).not.toHaveBeenCalled();
    },
  );

  it("does not guard the removed browser token endpoint", async () => {
    const removedPath = `/api/villas/1981/${[
      "booking-calendar",
      "token",
    ].join("-")}`;

    await expect(
      handleBookingCalendarAccess(
        calendarRequest({
          authorization: null,
          method: "POST",
          path: removedPath,
        }),
        createEnv(),
      ),
    ).resolves.toBeNull();
  });

  it("never logs the Authorization credential", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const authorization = "Bearer value-that-must-never-be-logged";

    await handleBookingCalendarAccess(
      calendarRequest({ authorization }),
      createEnv(),
    );

    const serializedLogs = JSON.stringify([
      ...consoleError.mock.calls,
      ...consoleLog.mock.calls,
      ...consoleWarn.mock.calls,
    ]);

    expect(serializedLogs).not.toContain(authorization);
    consoleError.mockRestore();
    consoleLog.mockRestore();
    consoleWarn.mockRestore();
  });
});
