/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeFetchMock,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";

const mocks = vi.hoisted(() => ({
  readAdminAccessToken: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
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
  useRouter: () => ({
    refresh: mocks.refresh,
    replace: mocks.replace,
  }),
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
});
