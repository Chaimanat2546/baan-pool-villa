/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  click,
  makeFetchMock,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { DEFAULT_DETAIL_LAYOUT_V2 } from "@/lib/detail-layout/defaults";
import type { DetailLayoutV2Config } from "@/lib/detail-layout/types";

const mocks = vi.hoisted(() => ({
  readAdminAccessToken: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));

const savedLayout: DetailLayoutV2Config = {
  ...DEFAULT_DETAIL_LAYOUT_V2,
  mainSplit: {
    ...DEFAULT_DETAIL_LAYOUT_V2.mainSplit,
    ratio: "30/70",
  },
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

import { AdminDetailLayoutPage } from "../admin-detail-layout-page";

describe("AdminDetailLayoutPage", () => {
  beforeEach(() => {
    mocks.readAdminAccessToken.mockResolvedValue("admin-token");
    mocks.refresh.mockReset();
    mocks.replace.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the detail layout and supports local reset interactions", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout },
        url: "/api/admin/detail-layout",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminDetailLayoutPage />);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/detail-layout",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
      }),
    );

    const resetButton = page.container.querySelector(
      "header button",
    ) as HTMLButtonElement | null;

    expect(resetButton).not.toBeNull();

    await click(resetButton as HTMLButtonElement);

    expect(
      fetchMock.mock.calls.every(([url, init]) => {
        return url === "/api/admin/detail-layout" && init?.method === undefined;
      }),
    ).toBe(true);

    await page.unmount();
  });
});
