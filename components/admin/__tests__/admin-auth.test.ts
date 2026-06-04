import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createBrowserHomeConfigClient: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/home-sections/supabase", () => ({
  createBrowserHomeConfigClient: mocks.createBrowserHomeConfigClient,
}));

import { readAdminAccessToken } from "../admin-auth";

describe("readAdminAccessToken", () => {
  it("returns the browser session access token", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "admin-token" } },
      error: null,
    });
    mocks.createBrowserHomeConfigClient.mockReturnValue({
      auth: { getSession: mocks.getSession },
    });

    await expect(readAdminAccessToken()).resolves.toBe("admin-token");
  });

  it("returns null when the browser session is missing", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mocks.createBrowserHomeConfigClient.mockReturnValue({
      auth: { getSession: mocks.getSession },
    });

    await expect(readAdminAccessToken()).resolves.toBeNull();
  });

  it("returns null when Supabase browser client setup fails", async () => {
    mocks.createBrowserHomeConfigClient.mockImplementation(() => {
      throw new Error("Home config Supabase environment is missing");
    });

    await expect(readAdminAccessToken()).resolves.toBeNull();
  });
});
