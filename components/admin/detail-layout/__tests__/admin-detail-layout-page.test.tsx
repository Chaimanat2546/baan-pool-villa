/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  click,
  flushEffects,
  makeFetchMock,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { DEFAULT_DETAIL_LAYOUT_V2 } from "@/lib/detail-layout/defaults";
import type { DetailLayoutV2Config } from "@/lib/detail-layout/types";

const mocks = vi.hoisted(() => ({
  readAdminAccessToken: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  router: {
    refresh: vi.fn(),
    replace: vi.fn(),
  },
}));

const savedLayout: DetailLayoutV2Config = {
  ...DEFAULT_DETAIL_LAYOUT_V2,
  mainSplit: {
    ...DEFAULT_DETAIL_LAYOUT_V2.mainSplit,
    ratio: "30/70",
  },
};

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
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
    mocks.router.refresh = mocks.refresh;
    mocks.router.replace = mocks.replace;
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
    const pageText = page.container.textContent ?? "";

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/detail-layout",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
      }),
    );
    expect(pageText).not.toContain("ปิดไว้");
    expect(pageText).not.toContain("บล็อกที่ใช้");

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

  it("places the settings and preview panel under the canvas before the three-column breakpoint", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout },
        url: "/api/admin/detail-layout",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminDetailLayoutPage />);
    const sidePanel = page.container.querySelector(
      '[data-detail-layout-side-panel="true"]',
    );

    expect(sidePanel?.className).toContain("xl:col-start-2");
    expect(sidePanel?.className).toContain("xl:row-start-2");
    expect(sidePanel?.className).toContain("2xl:col-start-3");
    expect(sidePanel?.className).toContain("2xl:row-start-1");

    await page.unmount();
  });

  it("saves a locally reset layout without refetching the page data", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout },
        url: "/api/admin/detail-layout",
      },
      {
        body: { layout: DEFAULT_DETAIL_LAYOUT_V2 },
        method: "PUT",
        url: "/api/admin/detail-layout",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminDetailLayoutPage />);
    const buttons = Array.from(page.container.querySelectorAll("header button"));
    const resetButton = buttons[0] as HTMLButtonElement | undefined;

    expect(resetButton).not.toBeUndefined();

    await click(resetButton as HTMLButtonElement);
    await flushEffects();
    const callsBeforeSave = fetchMock.mock.calls.length;

    const saveButton = Array.from(page.container.querySelectorAll("header button"))[1];

    expect(saveButton).not.toBeUndefined();

    await click(saveButton as HTMLButtonElement);
    await flushEffects();

    expect(fetchMock.mock.calls.length - callsBeforeSave).toBe(1);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/detail-layout",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json",
        },
        method: "PUT",
      }),
    );
    expect(mocks.refresh).not.toHaveBeenCalled();

    await page.unmount();
  });
});
