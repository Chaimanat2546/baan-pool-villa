import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertHomeConfigAdmin,
  getBearerToken,
  jsonError,
} from "@/lib/admin/home-config-auth";
import {
  adminSupabaseErrorResponse,
  requireHomeConfigAdmin,
} from "@/lib/admin/route-helpers";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/admin/home-config-auth", () => ({
  assertHomeConfigAdmin: vi.fn(),
  getBearerToken: vi.fn(),
  jsonError: vi.fn(
    (
      message: string,
      status: number,
      extra?: Record<string, string | null | undefined>,
    ) => Response.json({ error: message, ...extra }, { status }),
  ),
}));

const assertHomeConfigAdminMock = vi.mocked(assertHomeConfigAdmin);
const getBearerTokenMock = vi.mocked(getBearerToken);
const jsonErrorMock = vi.mocked(jsonError);
const originalNodeEnv = process.env.NODE_ENV;
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

function restoreEnvValue(
  name: "NODE_ENV" | "NEXT_PUBLIC_SITE_URL",
  value: string | undefined,
) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function request(options?: { method?: string; origin?: string; url?: string }) {
  const headers = new Headers({ authorization: "Bearer token" });

  if (options?.origin) {
    headers.set("origin", options.origin);
  }

  return new Request(options?.url ?? "https://example.com/api/admin/test", {
    method: options?.method ?? "GET",
    headers,
  });
}

describe("admin route helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreEnvValue("NODE_ENV", originalNodeEnv);
    restoreEnvValue("NEXT_PUBLIC_SITE_URL", originalSiteUrl);
    getBearerTokenMock.mockReturnValue("token");
  });

  afterEach(() => {
    restoreEnvValue("NODE_ENV", originalNodeEnv);
    restoreEnvValue("NEXT_PUBLIC_SITE_URL", originalSiteUrl);
  });

  it("returns a 401 response without calling Supabase auth when bearer token is missing", async () => {
    getBearerTokenMock.mockReturnValue(null);

    const result = await requireHomeConfigAdmin(request());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      await expect(result.response.json()).resolves.toEqual({
        error: "Missing bearer token.",
      });
    }
    expect(assertHomeConfigAdminMock).not.toHaveBeenCalled();
  });

  it("preserves admin auth failure status and message", async () => {
    assertHomeConfigAdminMock.mockResolvedValue({
      ok: false,
      message: "Signed-in user is not listed as an active home config admin.",
      status: 403,
    });

    const result = await requireHomeConfigAdmin(request());

    expect(result.ok).toBe(false);
    expect(assertHomeConfigAdminMock).toHaveBeenCalledWith("token");
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      await expect(result.response.json()).resolves.toEqual({
        error: "Signed-in user is not listed as an active home config admin.",
      });
    }
  });

  it("returns the scoped Supabase client for an authorized admin", async () => {
    const supabase = { from: vi.fn() };

    assertHomeConfigAdminMock.mockResolvedValue({
      ok: true,
      supabase,
    } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);

    const result = await requireHomeConfigAdmin(request());

    expect(result).toEqual({ ok: true, supabase });
    expect(assertHomeConfigAdminMock).toHaveBeenCalledWith("token");
  });

  it("rejects admin mutation requests without an origin header before bearer auth", async () => {
    const result = await requireHomeConfigAdmin(request({ method: "PUT" }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      await expect(result.response.json()).resolves.toEqual({
        error: "Admin request origin is not allowed.",
      });
    }
    expect(getBearerTokenMock).not.toHaveBeenCalled();
    expect(assertHomeConfigAdminMock).not.toHaveBeenCalled();
  });

  it("allows admin mutation requests from the configured site origin", async () => {
    const supabase = { from: vi.fn() };
    process.env.NEXT_PUBLIC_SITE_URL = "https://baan.example";

    assertHomeConfigAdminMock.mockResolvedValue({
      ok: true,
      supabase,
    } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);

    const result = await requireHomeConfigAdmin(
      request({
        method: "POST",
        origin: "https://baan.example",
        url: "https://internal.example/api/admin/test",
      }),
    );

    expect(result).toEqual({ ok: true, supabase });
    expect(assertHomeConfigAdminMock).toHaveBeenCalledWith("token");
  });

  it("allows admin mutation requests from the request host", async () => {
    const supabase = { from: vi.fn() };

    assertHomeConfigAdminMock.mockResolvedValue({
      ok: true,
      supabase,
    } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);

    const result = await requireHomeConfigAdmin(
      request({
        method: "PUT",
        origin: "https://admin.example:8443",
        url: "https://admin.example:8443/api/admin/test",
      }),
    );

    expect(result).toEqual({ ok: true, supabase });
    expect(assertHomeConfigAdminMock).toHaveBeenCalledWith("token");
  });

  it("rejects admin mutation requests from the request host over a different scheme", async () => {
    const result = await requireHomeConfigAdmin(
      request({
        method: "PUT",
        origin: "http://admin.example:8443",
        url: "https://admin.example:8443/api/admin/test",
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      await expect(result.response.json()).resolves.toEqual({
        error: "Admin request origin is not allowed.",
      });
    }
    expect(getBearerTokenMock).not.toHaveBeenCalled();
    expect(assertHomeConfigAdminMock).not.toHaveBeenCalled();
  });

  it("allows localhost admin mutation requests in development", async () => {
    const supabase = { from: vi.fn() };
    process.env.NODE_ENV = "development";

    assertHomeConfigAdminMock.mockResolvedValue({
      ok: true,
      supabase,
    } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);

    const result = await requireHomeConfigAdmin(
      request({
        method: "POST",
        origin: "http://localhost:3000",
        url: "https://preview.example/api/admin/test",
      }),
    );

    expect(result).toEqual({ ok: true, supabase });
    expect(assertHomeConfigAdminMock).toHaveBeenCalledWith("token");
  });

  it("rejects cross-origin admin mutation requests before bearer auth", async () => {
    const result = await requireHomeConfigAdmin(
      request({ method: "DELETE", origin: "https://attacker.example" }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      await expect(result.response.json()).resolves.toEqual({
        error: "Admin request origin is not allowed.",
      });
    }
    expect(getBearerTokenMock).not.toHaveBeenCalled();
    expect(assertHomeConfigAdminMock).not.toHaveBeenCalled();
  });

  it("does not block admin GET requests from a different origin", async () => {
    const supabase = { from: vi.fn() };

    assertHomeConfigAdminMock.mockResolvedValue({
      ok: true,
      supabase,
    } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);

    const result = await requireHomeConfigAdmin(
      request({ method: "GET", origin: "https://attacker.example" }),
    );

    expect(result).toEqual({ ok: true, supabase });
    expect(assertHomeConfigAdminMock).toHaveBeenCalledWith("token");
  });

  it.each([
    [{ code: "42501", message: "permission denied" }, 403],
    [{ code: "PGRST301", message: "JWT expired" }, 401],
    [{ code: "PGRST116", message: "JSON object requested, 0 rows" }, 404],
    [{ code: "42703", message: "column does not exist" }, 500],
    [{ message: "upstream failed", status: 502 }, 502],
    [{ message: "upstream failed", statusCode: 503 }, 503],
    [{ message: "storage failed", statusCode: "400" }, 400],
  ])("maps Supabase error %j to HTTP %i", async (error, expectedStatus) => {
    const response = adminSupabaseErrorResponse(error, "Fallback message.");

    expect(response.status).toBe(expectedStatus);
    const body = await response.json();

    expect(body).toMatchObject({ error: error.message });
    if (error.code) {
      expect(body).toMatchObject({ code: error.code });
    }
  });

  it("keeps fallback messages and extra metadata in standardized Supabase errors", async () => {
    const response = adminSupabaseErrorResponse(
      { code: "42501", details: "RLS denied", hint: "check policy" },
      "Unable to save settings.",
      { warning: "Cleanup skipped." },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to save settings.",
      code: "42501",
      details: "RLS denied",
      hint: "check policy",
      warning: "Cleanup skipped.",
    });
    expect(jsonErrorMock).toHaveBeenCalledWith(
      "Unable to save settings.",
      403,
      {
        code: "42501",
        details: "RLS denied",
        hint: "check policy",
        warning: "Cleanup skipped.",
      },
    );
  });
});
