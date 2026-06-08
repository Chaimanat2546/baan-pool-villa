/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  changeInput,
  click,
  flushEffects,
  makeFetchMock,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";

const mocks = vi.hoisted(() => ({
  readAdminAccessToken: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  router: {
    refresh: vi.fn(),
    replace: vi.fn(),
  },
}));

const tikTokSettings = {
  accountUrl: "https://www.tiktok.com/@baanpoolvilla",
  videos: [
    {
      url: "https://www.tiktok.com/@baanpoolvilla/video/1234567890",
      videoId: "1234567890",
    },
  ],
};

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/components/admin/admin-auth", () => ({
  readAdminAccessToken: mocks.readAdminAccessToken,
}));

import { AdminTikTokPage } from "../admin-tiktok-page";

describe("AdminTikTokPage", () => {
  beforeEach(() => {
    mocks.readAdminAccessToken.mockResolvedValue("admin-token");
    mocks.refresh.mockReset();
    mocks.replace.mockReset();
    mocks.router.refresh = mocks.refresh;
    mocks.router.replace = mocks.replace;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads TikTok settings through the admin fetch flow", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { settings: tikTokSettings },
        url: "/api/admin/tiktok",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminTikTokPage />);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/tiktok",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
      }),
    );

    expect(page.container.querySelector("#tiktokAccountUrl")).not.toBeNull();
    expect(
      page.container.querySelectorAll("input[id^='tiktokVideoUrl-']"),
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.every(([url, init]) => {
        return url === "/api/admin/tiktok" && init?.method === undefined;
      }),
    ).toBe(true);

    await page.unmount();
  });

  it("uses the saved TikTok response without forcing a route refresh", async () => {
    const updatedSettings = {
      accountUrl: "https://www.tiktok.com/@baanpoolvilla-updated",
      videos: tikTokSettings.videos,
    };
    const fetchMock = makeFetchMock([
      {
        body: { settings: tikTokSettings },
        url: "/api/admin/tiktok",
      },
      {
        body: { settings: updatedSettings, source: "config" },
        method: "PUT",
        url: "/api/admin/tiktok",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminTikTokPage />);
    const accountInput = page.container.querySelector(
      "#tiktokAccountUrl",
    ) as HTMLInputElement | null;

    expect(accountInput).not.toBeNull();

    await changeInput(accountInput as HTMLInputElement, updatedSettings.accountUrl);
    const callsBeforeSave = fetchMock.mock.calls.length;

    const saveButton = Array.from(page.container.querySelectorAll("button")).find(
      (button) => {
        return button.textContent?.includes("บันทึกการตั้งค่า TikTok");
      },
    );

    expect(saveButton).not.toBeNull();

    await click(saveButton as HTMLButtonElement);
    await flushEffects();

    expect(fetchMock.mock.calls.length - callsBeforeSave).toBe(1);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/tiktok",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
        method: "PUT",
      }),
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(
      (page.container.querySelector("#tiktokAccountUrl") as HTMLInputElement | null)?.value,
    ).toBe(updatedSettings.accountUrl);

    await page.unmount();
  });
});
