/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";

import {
  changeInput,
  click,
  flushEffects,
  makeFetchMock,
  makeJsonResponse,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";

const mocks = vi.hoisted(() => ({
  readAdminAccessToken: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  loadTikTokClientOEmbed: vi.fn(),
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
      houseId: null,
    },
  ],
};

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/components/admin/admin-auth", () => ({
  readAdminAccessToken: mocks.readAdminAccessToken,
}));

vi.mock("@/components/villas/home/tiktok-client-oembed", () => ({
  loadTikTokClientOEmbed: mocks.loadTikTokClientOEmbed,
}));

import { AdminTikTokPage } from "../admin-tiktok-page";

async function waitForVillaSearch() {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 275);
    });
  });
}

describe("AdminTikTokPage", () => {
  beforeEach(() => {
    mocks.readAdminAccessToken.mockResolvedValue("admin-token");
    mocks.loadTikTokClientOEmbed.mockResolvedValue(null);
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
        return button.textContent?.includes("บันทึก");
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

  it("debounces an authenticated villa search, then keeps the selected villa on its video row", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { settings: tikTokSettings },
        url: "/api/admin/tiktok",
      },
      {
        body: { villas: [{ id: "501", title: "Glass House B8" }] },
        url: "/api/admin/tiktok/villas?q=Glass%20House",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminTikTokPage />);
    const villaSearch = page.container.querySelector(
      "input[id^='tiktokVillaSearch-']",
    ) as HTMLInputElement | null;

    expect(villaSearch).not.toBeNull();
    await changeInput(villaSearch as HTMLInputElement, "Glass House");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitForVillaSearch();
    await flushEffects();

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/tiktok/villas?q=Glass%20House",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
        signal: expect.any(AbortSignal),
      }),
    );

    const villaChoice = Array.from(page.container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Glass House B8"),
    );
    expect(villaChoice).not.toBeNull();
    await click(villaChoice as HTMLButtonElement);

    expect(
      (page.container.querySelector("input[id^='tiktokVillaSearch-']") as HTMLInputElement)
        .value,
    ).toBe("Glass House B8");

    const clearButton = Array.from(page.container.querySelectorAll("button")).find(
      (button) => button.textContent === "ล้าง",
    );
    expect(clearButton).not.toBeNull();
    await click(clearButton as HTMLButtonElement);
    expect((villaSearch as HTMLInputElement).value).toBe("");

    await page.unmount();
  });

  it("shows a Thai inline search error without redirecting for a non-auth failure", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { settings: tikTokSettings },
        url: "/api/admin/tiktok",
      },
      {
        body: { error: "Catalog unavailable" },
        status: 500,
        url: "/api/admin/tiktok/villas?q=broken",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminTikTokPage />);
    const villaSearch = page.container.querySelector(
      "input[id^='tiktokVillaSearch-']",
    ) as HTMLInputElement;

    await changeInput(villaSearch, "broken");
    await waitForVillaSearch();
    await flushEffects();

    expect(page.container.textContent).toContain("Catalog unavailable");
    expect(mocks.replace).not.toHaveBeenCalled();

    await changeInput(villaSearch, "retry");
    expect(page.container.textContent).not.toContain("Catalog unavailable");

    await page.unmount();
  });

  it("clears prior results and ignores a deferred response after the query changes", async () => {
    let resolveLateSearch: ((response: Response) => void) | undefined;
    const lateSearch = new Promise<Response>((resolve) => {
      resolveLateSearch = resolve;
    });
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/admin/tiktok") {
        return Promise.resolve(makeJsonResponse({ body: { settings: tikTokSettings } }));
      }
      if (url === "/api/admin/tiktok/villas?q=glass") {
        return Promise.resolve(
          makeJsonResponse({ body: { villas: [{ id: "501", title: "Glass House B8" }] } }),
        );
      }
      if (url === "/api/admin/tiktok/villas?q=late") {
        return lateSearch;
      }

      return Promise.resolve(makeJsonResponse({ body: { villas: [] } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminTikTokPage />);
    const villaSearch = page.container.querySelector(
      "input[id^='tiktokVillaSearch-']",
    ) as HTMLInputElement;

    await changeInput(villaSearch, "glass");
    await waitForVillaSearch();
    await flushEffects();
    expect(page.container.textContent).toContain("Glass House B8");

    await changeInput(villaSearch, "late");
    expect(page.container.textContent).not.toContain("Glass House B8");
    await waitForVillaSearch();

    await changeInput(villaSearch, "next");
    resolveLateSearch?.(
      makeJsonResponse({ body: { villas: [{ id: "777", title: "Late Villa" }] } }),
    );
    await flushEffects();

    expect(page.container.textContent).not.toContain("Late Villa");
    expect(page.container.textContent).not.toContain("Glass House B8");

    await page.unmount();
  });

  it("materializes the empty video row before saving its selected villa association", async () => {
    const emptySettings = {
      accountUrl: "https://www.tiktok.com/@baanpoolvilla",
      videos: [],
    };
    const fetchMock = makeFetchMock([
      { body: { settings: emptySettings }, url: "/api/admin/tiktok" },
      {
        body: { villas: [{ id: "501", title: "Glass House B8" }] },
        url: "/api/admin/tiktok/villas?q=glass",
      },
      {
        body: { settings: emptySettings },
        method: "PUT",
        url: "/api/admin/tiktok",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminTikTokPage />);
    const villaSearch = page.container.querySelector(
      "input[id^='tiktokVillaSearch-']",
    ) as HTMLInputElement;

    await changeInput(villaSearch, "glass");
    await waitForVillaSearch();
    const villaChoice = Array.from(page.container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Glass House B8"),
    );
    await click(villaChoice as HTMLButtonElement);

    expect(
      (page.container.querySelector("input[id^='tiktokVillaSearch-']") as HTMLInputElement)
        .value,
    ).toBe("Glass House B8");
    const videoInput = page.container.querySelector(
      "input[id^='tiktokVideoUrl-']",
    ) as HTMLInputElement;
    await changeInput(videoInput, "https://www.tiktok.com/@baanpoolvilla/video/1234567890");

    const saveButton = Array.from(page.container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("บันทึก"),
    );
    await click(saveButton as HTMLButtonElement);

    const saveCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    const formData = saveCall?.[1]?.body as FormData;
    expect(JSON.parse(String(formData.get("tiktokVideoUrls")))).toEqual([
      {
        houseId: "501",
        url: "https://www.tiktok.com/@baanpoolvilla/video/1234567890",
      },
    ]);

    await page.unmount();
  });
});
