import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getTurnstileClientIp,
  getTurnstileConfig,
  resetTurnstileWarningForTests,
  TURNSTILE_SITEVERIFY_URL,
  verifyTurnstileToken,
} from "@/lib/admin/turnstile";

vi.mock("server-only", () => ({}));

const originalNodeEnv = process.env.NODE_ENV;
const originalSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const originalSecretKey = process.env.TURNSTILE_SECRET_KEY;
const testEnv = process.env as Record<string, string | undefined>;

function restoreEnv() {
  testEnv.NODE_ENV = originalNodeEnv;
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalSiteKey;
  process.env.TURNSTILE_SECRET_KEY = originalSecretKey;
}

function request(headers?: HeadersInit) {
  return new Request("https://baan.example/api/admin/login/turnstile", {
    headers,
    method: "POST",
  });
}

describe("Turnstile admin login verification", () => {
  beforeEach(() => {
    restoreEnv();
    resetTurnstileWarningForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    restoreEnv();
    resetTurnstileWarningForTests();
    vi.unstubAllGlobals();
  });

  it("fails closed in production when either Turnstile key is missing", async () => {
    testEnv.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    delete process.env.TURNSTILE_SECRET_KEY;

    expect(getTurnstileConfig()).toMatchObject({
      isConfigured: false,
      isDevelopment: false,
      shouldBypass: false,
    });
    await expect(
      verifyTurnstileToken({ request: request(), token: "token" }),
    ).resolves.toEqual({
      message: "Turnstile is not configured.",
      ok: false,
      status: 503,
    });
  });

  it("bypasses in development even when keys are configured and warns once", async () => {
    testEnv.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.TURNSTILE_SECRET_KEY = "secret-key";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const first = await verifyTurnstileToken({ request: request(), token: "" });
    const second = await verifyTurnstileToken({ request: request(), token: "" });

    expect(first).toEqual({ bypassed: true, ok: true });
    expect(second).toEqual({ bypassed: true, ok: true });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "Turnstile verification is bypassed in development.",
    );
  });

  it("reads the visitor IP from Cloudflare or forwarded headers", () => {
    expect(
      getTurnstileClientIp(request({ "CF-Connecting-IP": "203.0.113.10" })),
    ).toBe("203.0.113.10");
    expect(
      getTurnstileClientIp(
        request({ "X-Forwarded-For": "198.51.100.20, 198.51.100.21" }),
      ),
    ).toBe("198.51.100.20");
    expect(getTurnstileClientIp(request())).toBeNull();
  });

  it("sends the token, secret, and remote IP to Cloudflare Siteverify", async () => {
    testEnv.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.TURNSTILE_SECRET_KEY = "secret-key";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      verifyTurnstileToken({
        request: request({ "CF-Connecting-IP": "203.0.113.10" }),
        token: "challenge-token",
      }),
    ).resolves.toEqual({ bypassed: false, ok: true });

    expect(fetchMock).toHaveBeenCalledWith(
      TURNSTILE_SITEVERIFY_URL,
      expect.objectContaining({
        cache: "no-store",
        method: "POST",
        signal: expect.any(AbortSignal),
      }),
    );
    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get("secret")).toBe("secret-key");
    expect(body.get("response")).toBe("challenge-token");
    expect(body.get("remoteip")).toBe("203.0.113.10");
  });

  it("rejects failed and unavailable Siteverify responses", async () => {
    testEnv.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.TURNSTILE_SECRET_KEY = "secret-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false })))
      .mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      verifyTurnstileToken({ request: request(), token: "bad-token" }),
    ).resolves.toEqual({
      message: "Turnstile verification failed.",
      ok: false,
      status: 403,
    });
    await expect(
      verifyTurnstileToken({ request: request(), token: "token" }),
    ).resolves.toEqual({
      message: "Turnstile verification is unavailable.",
      ok: false,
      status: 502,
    });
  });

  it("logs only safe Siteverify diagnostics when Cloudflare rejects a token", async () => {
    testEnv.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.TURNSTILE_SECRET_KEY = "secret-key";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            action: "admin_login",
            "error-codes": ["invalid-input-response"],
            hostname: "baan-pool-villa-staging.chaymanus2003.workers.dev",
            secret: "must-not-be-logged",
            success: false,
            token: "must-not-be-logged",
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(
      verifyTurnstileToken({
        request: request(),
        token: "challenge-token",
      }),
    ).resolves.toEqual({
      message: "Turnstile verification failed.",
      ok: false,
      status: 403,
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "Turnstile Siteverify rejected a token.",
      {
        action: "admin_login",
        errorCodes: ["invalid-input-response"],
        hostname: "baan-pool-villa-staging.chaymanus2003.workers.dev",
      },
    );
  });

  it("returns unavailable when Siteverify times out", async () => {
    testEnv.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.TURNSTILE_SECRET_KEY = "secret-key";
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new DOMException("The operation was aborted.", "AbortError"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      verifyTurnstileToken({ request: request(), token: "token" }),
    ).resolves.toEqual({
      message: "Turnstile verification is unavailable.",
      ok: false,
      status: 502,
    });
  });
});
