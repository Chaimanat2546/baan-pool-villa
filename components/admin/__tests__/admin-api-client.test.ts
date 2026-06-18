import { describe, expect, it } from "vitest";

import {
  extractAdminErrors,
  readJsonPayload,
  shouldRedirectToLogin,
} from "../admin-api-client";

describe("admin API client helpers", () => {
  it("reads JSON payloads and returns null for non-JSON responses", async () => {
    await expect(
      readJsonPayload(Response.json({ ok: true })),
    ).resolves.toEqual({ ok: true });

    await expect(
      readJsonPayload(new Response("not json")),
    ).resolves.toBeNull();
  });

  it("extracts translated error arrays and detailed error payloads", () => {
    expect(
      extractAdminErrors(
        { errors: ["Missing bearer token.", ""] },
        "Fallback",
      ),
    ).toEqual(["กรุณาเข้าสู่ระบบอีกครั้ง"]);

    expect(
      extractAdminErrors(
        {
          code: "42501",
          details: "policy denied",
          error: "Unable to save site settings.",
          hint: "check grants",
        },
        "Fallback",
      ),
    ).toEqual([
      "ไม่สามารถบันทึกการตั้งค่าเว็บไซต์ได้ (42501 / policy denied / check grants)",
    ]);
  });

  it("redirects only auth/session failures", () => {
    expect(shouldRedirectToLogin(401, { error: "Unauthorized" })).toBe(true);
    expect(
      shouldRedirectToLogin(403, {
        error: "Signed-in user is not listed as an active home config admin.",
      }),
    ).toBe(true);
    expect(
      shouldRedirectToLogin(403, {
        error: "Unable to verify admin access: permission denied",
      }),
    ).toBe(true);
    expect(
      shouldRedirectToLogin(403, { error: "Storage upload failed" }),
    ).toBe(false);
  });
});
