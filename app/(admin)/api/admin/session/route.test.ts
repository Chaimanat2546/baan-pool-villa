import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  inspect: vi.fn(),
}));

vi.mock("@/lib/admin/forced-password-change", () => ({
  inspectForcedPasswordSession: mocks.inspect,
}));

import { GET } from "./route";

describe("GET /api/admin/session", () => {
  beforeEach(() => {
    mocks.inspect.mockReset();
  });

  it("returns the stable forced state for a strict bearer session", async () => {
    mocks.inspect.mockResolvedValue({
      state: "forced",
      userId: "11111111-1111-4111-8111-111111111111",
      email: "admin@example.com",
      credentialVersion: 7,
    });

    const response = await GET(
      new Request("https://example.com/api/admin/session", {
        headers: { Authorization: "Bearer browser-token" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: "forced" });
    expect(mocks.inspect).toHaveBeenCalledWith("browser-token");
  });

  it.each([
    ["active", 200],
    ["inactive", 403],
    ["invalid", 401],
    ["version_mismatch", 403],
    ["verification_failed", 500],
  ] as const)("maps %s without leaking identity fields", async (state, status) => {
    mocks.inspect.mockResolvedValue(
      state === "active"
        ? {
            state,
            userId: "11111111-1111-4111-8111-111111111111",
            email: "admin@example.com",
            credentialVersion: 7,
          }
        : {
            state,
            status,
            code: `${state}_code`,
            message: "safe",
          },
    );

    const response = await GET(
      new Request("https://example.com/api/admin/session", {
        headers: { Authorization: "Bearer browser-token" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(status);
    expect(body).toMatchObject({ state });
    expect(JSON.stringify(body)).not.toContain("admin@example.com");
  });

  it("rejects a missing bearer token without inspecting Auth", async () => {
    const response = await GET(
      new Request("https://example.com/api/admin/session"),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "session_invalid" });
    expect(mocks.inspect).not.toHaveBeenCalled();
  });
});
