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

function postRequest() {
  return new Request("https://example.com/api/admin/external-data/refresh", {
    headers: {
      authorization: "Bearer token",
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

  it("revalidates external villa cache for authenticated admins", async () => {
    const { POST } = await import(
      "../app/(admin)/api/admin/external-data/refresh/route"
    );
    const response = await POST(postRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      refreshed: true,
      message: "External villa data cache refresh requested.",
    });
    expect(revalidateExternalVillaCacheMock).toHaveBeenCalledTimes(1);
  });
});
