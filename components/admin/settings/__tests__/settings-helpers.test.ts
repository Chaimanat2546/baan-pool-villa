import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/site-settings/colors", () => ({
  buildSiteThemeStyle: vi.fn(),
}));

import { extractErrors, shouldRedirectToLogin } from "../settings-helpers";

describe("settings helpers", () => {
  it("does not redirect message-only Supabase or storage errors", () => {
    const payload = { error: "Storage upload failed" };

    expect(shouldRedirectToLogin(403, payload)).toBe(false);
    expect(extractErrors(payload, "Unable to save site settings.")).toEqual([
      "Storage upload failed",
    ]);
  });

  it("redirects 401 responses to login", () => {
    expect(shouldRedirectToLogin(401, { error: "Unauthorized" })).toBe(true);
  });

  it("redirects known admin access failures to login", () => {
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
  });
});
