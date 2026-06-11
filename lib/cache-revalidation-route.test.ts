import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertHomeConfigAdmin,
  getBearerToken,
} from "@/lib/admin/home-config-auth";
import { revalidateExternalVillaCache } from "./cache-revalidation";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/admin/home-config-auth", () => ({
  assertHomeConfigAdmin: vi.fn(),
  getBearerToken: vi.fn(),
  jsonError: vi.fn((message: string, status: number) =>
    Response.json({ error: message }, { status }),
  ),
}));

vi.mock("./cache-revalidation", () => ({
  revalidateExternalVillaCache: vi.fn(),
}));

const assertHomeConfigAdminMock = vi.mocked(assertHomeConfigAdmin);
const getBearerTokenMock = vi.mocked(getBearerToken);
const revalidateExternalVillaCacheMock = vi.mocked(revalidateExternalVillaCache);

function postRequest({
  confirmed = false,
  scope,
}: {
  confirmed?: boolean;
  scope?: string;
} = {}) {
  return new Request("https://example.com/api/admin/external-data/refresh", {
    headers: {
      authorization: "Bearer token",
      origin: "https://example.com",
      ...(confirmed
        ? { "x-admin-refresh-confirmation": "external-villa-cache" }
        : {}),
      ...(scope ? { "x-admin-refresh-scope": scope } : {}),
    },
    method: "POST",
  });
}

describe("admin external data refresh route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getBearerTokenMock.mockReturnValue("token");
    assertHomeConfigAdminMock.mockResolvedValue({
      ok: true,
      supabase: {},
    } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);
  });

  it("requires an admin token before revalidating external villa cache", async () => {
    getBearerTokenMock.mockReturnValue(null);

    const { POST } = await import(
      "../app/(admin)/api/admin/external-data/refresh/route"
    );
    const response = await POST(postRequest());

    expect(response.status).toBe(401);
    expect(assertHomeConfigAdminMock).not.toHaveBeenCalled();
    expect(revalidateExternalVillaCacheMock).not.toHaveBeenCalled();
  });

  it("revalidates only external villa tags by default for authenticated admins", async () => {
    const { POST } = await import(
      "../app/(admin)/api/admin/external-data/refresh/route"
    );
    const response = await POST(postRequest({ confirmed: true }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      refreshed: true,
      scope: "tags-only",
      retryAfterSeconds: 60,
      message: "External villa data cache refresh requested.",
    });
    expect(revalidateExternalVillaCacheMock).toHaveBeenCalledWith();
  });

  it("rejects full-public refresh because rendered page cache is disabled", async () => {
    const { POST } = await import(
      "../app/(admin)/api/admin/external-data/refresh/route"
    );
    const response = await POST(
      postRequest({ confirmed: true, scope: "full-public" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Unsupported external villa cache refresh scope.",
    });
    expect(revalidateExternalVillaCacheMock).not.toHaveBeenCalled();
  });

  it("rejects unknown external villa refresh scopes", async () => {
    const { POST } = await import(
      "../app/(admin)/api/admin/external-data/refresh/route"
    );
    const response = await POST(
      postRequest({ confirmed: true, scope: "everything" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Unsupported external villa cache refresh scope.",
    });
    expect(revalidateExternalVillaCacheMock).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation before revalidating external villa cache", async () => {
    const { POST } = await import(
      "../app/(admin)/api/admin/external-data/refresh/route"
    );
    const response = await POST(postRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "External villa cache refresh requires confirmation.",
    });
    expect(revalidateExternalVillaCacheMock).not.toHaveBeenCalled();
  });

  it("rate limits repeated confirmed refresh requests", async () => {
    const { POST } = await import(
      "../app/(admin)/api/admin/external-data/refresh/route"
    );

    const firstResponse = await POST(postRequest({ confirmed: true }));
    const secondResponse = await POST(postRequest({ confirmed: true }));

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(429);
    await expect(secondResponse.json()).resolves.toEqual({
      error: "External villa cache refresh was requested recently.",
      retryAfterSeconds: 60,
    });
    expect(revalidateExternalVillaCacheMock).toHaveBeenCalledTimes(1);
  });
});
