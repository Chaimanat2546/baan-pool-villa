/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import {
  click,
  makeFetchMock,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";

const mocks = vi.hoisted(() => ({
  readAdminAccessToken: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.refresh,
    replace: mocks.replace,
  }),
}));

vi.mock("@/components/admin/admin-auth", () => ({
  readAdminAccessToken: mocks.readAdminAccessToken,
}));

import { AdminSettingsPage } from "../admin-settings-page";

describe("AdminSettingsPage", () => {
  beforeEach(() => {
    mocks.readAdminAccessToken.mockResolvedValue("admin-token");
    mocks.refresh.mockReset();
    mocks.replace.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads settings and refreshes external data with the admin token", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { settings: DEFAULT_SITE_SETTINGS },
        url: "/api/admin/site-settings",
      },
      {
        body: { message: "refresh complete", refreshed: true },
        method: "POST",
        url: "/api/admin/external-data/refresh",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSettingsPage />);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/site-settings",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
      }),
    );
    expect(page.container.querySelector("#settingsPageHeader")).not.toBeNull();

    const refreshButton = page.container.querySelector("button");
    expect(refreshButton).not.toBeNull();

    await click(refreshButton as HTMLButtonElement);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/external-data/refresh",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
        method: "POST",
      }),
    );
    expect(page.container.querySelector("[role='status']")).not.toBeNull();
    expect(mocks.refresh).toHaveBeenCalledOnce();

    await page.unmount();
  });
});
