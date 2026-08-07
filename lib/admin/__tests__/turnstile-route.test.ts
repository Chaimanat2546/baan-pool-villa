import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const originalNodeEnv = process.env.NODE_ENV;
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const originalSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const originalSecretKey = process.env.TURNSTILE_SECRET_KEY;
const testEnv = process.env as Record<string, string | undefined>;

function restoreEnv() {
  testEnv.NODE_ENV = originalNodeEnv;
  process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalSiteKey;
  process.env.TURNSTILE_SECRET_KEY = originalSecretKey;
}

function routeRequest(options?: {
  body?: unknown;
  origin?: string;
  url?: string;
}) {
  const headers = new Headers({ "Content-Type": "application/json" });

  headers.set("origin", options?.origin ?? "https://baan.example");

  return new Request(
    options?.url ?? "https://baan.example/api/admin/login/turnstile",
    {
      body: JSON.stringify(options?.body ?? { token: "challenge-token" }),
      headers,
      method: "POST",
    },
  );
}

async function importPostRoute() {
  const route = await import(
    "../../../app/(admin)/api/admin/login/turnstile/route"
  );

  return route.POST;
}

describe("admin login Turnstile route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    restoreEnv();
    testEnv.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://baan.example";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.TURNSTILE_SECRET_KEY = "secret-key";
  });

  afterEach(() => {
    restoreEnv();
    vi.unstubAllGlobals();
  });

  it("rejects disallowed mutation origins before verifying with Cloudflare", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const POST = await importPostRoute();

    const response = await POST(
      routeRequest({ origin: "https://attacker.example" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Admin request origin is not allowed.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 when a token is missing and verification is required", async () => {
    const POST = await importPostRoute();

    const response = await POST(routeRequest({ body: { token: "" } }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing Turnstile token.",
    });
  });

  it("returns a verified response when Siteverify succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }))),
    );
    const POST = await importPostRoute();

    const response = await POST(routeRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      bypassed: false,
      verified: true,
    });
  });

  it("returns 403 when Siteverify rejects the token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }))),
    );
    const POST = await importPostRoute();

    const response = await POST(routeRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Turnstile verification failed.",
    });
  });

  it("returns a bypassed response in development even when keys are configured", async () => {
    testEnv.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.TURNSTILE_SECRET_KEY = "secret-key";
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const POST = await importPostRoute();

    const response = await POST(routeRequest({ body: { token: "" } }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      bypassed: true,
      verified: true,
    });
  });
});
