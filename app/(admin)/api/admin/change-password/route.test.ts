import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const mocks = vi.hoisted(() => ({
  change: vi.fn(),
  createDependencies: vi.fn(() => ({ marker: "deps" })),
}));

vi.mock("@/lib/admin/forced-password-change", () => ({
  changeForcedPassword: mocks.change,
  createForcedPasswordChangeDependencies: mocks.createDependencies,
}));

import { POST } from "./route";

function request(body: unknown, options?: { contentType?: string; origin?: string }) {
  return new Request("https://example.com/api/admin/change-password", {
    method: "POST",
    headers: {
      Authorization: "Bearer browser-token",
      "Content-Type": options?.contentType ?? "application/json",
      Origin: options?.origin ?? "https://example.com",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validBody = {
  operationId: OPERATION_ID,
  currentPassword: "TempPass1!",
  newPassword: "NewPass2@",
  confirmPassword: "NewPass2@",
};

describe("POST /api/admin/change-password", () => {
  beforeEach(() => {
    mocks.change.mockReset();
    mocks.createDependencies.mockClear();
    mocks.change.mockResolvedValue({
      ok: true,
      code: "password_changed",
      clearSession: true,
    });
  });

  it("passes only the allowlisted fields and bearer token to the service", async () => {
    const response = await POST(request(validBody));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      code: "password_changed",
      clearSession: true,
    });
    expect(mocks.change).toHaveBeenCalledWith(
      { ...validBody, token: "browser-token" },
      { marker: "deps" },
    );
  });

  it.each([
    ["parameterized content type", request(validBody, { contentType: "application/json; charset=utf-8" })],
    ["cross-site origin", request(validBody, { origin: "https://attacker.example" })],
    ["malformed JSON", request("{")],
    ["unknown key", request({ ...validBody, extra: true })],
    ["invalid UUID", request({ ...validBody, operationId: "not-a-uuid" })],
  ])("rejects %s before invoking the service", async (_name, input) => {
    const response = await POST(input);

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(mocks.change).not.toHaveBeenCalled();
  });

  it("rejects an oversized body before parsing it", async () => {
    const response = await POST(
      request({ ...validBody, currentPassword: "x".repeat(3000) }),
    );

    expect(response.status).toBe(413);
    expect(mocks.change).not.toHaveBeenCalled();
  });

  it("returns stable service failures without password values", async () => {
    mocks.change.mockResolvedValue({
      ok: false,
      code: "temporary_password_invalid",
      clearSession: false,
    });

    const response = await POST(request(validBody));
    const text = await response.text();

    expect(response.status).toBe(401);
    expect(text).toContain("temporary_password_invalid");
    expect(text).not.toContain("TempPass1!");
    expect(text).not.toContain("NewPass2@");
  });

  it("returns a fail-closed service status when quarantine cannot be proven", async () => {
    mocks.change.mockResolvedValue({
      ok: false,
      code: "quarantine_failed",
      clearSession: true,
    });

    const response = await POST(request(validBody));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      code: "quarantine_failed",
      clearSession: true,
    });
  });
});
