/** @vitest-environment jsdom */
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { changeInput, click, makeJsonResponse, mountAdminPage } from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";

const mocks = vi.hoisted(() => ({ readAdminAccessToken: vi.fn(), replace: vi.fn(), router: { replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/components/admin/admin-auth", () => ({ readAdminAccessToken: mocks.readAdminAccessToken }));

import { SettingsDirtyStateProvider } from "../settings-dirty-state";
import { BrandSettingsPage } from "../brand-settings-page";

describe("BrandSettingsPage", () => {
  beforeEach(() => { mocks.readAdminAccessToken.mockResolvedValue("token"); mocks.router.replace = mocks.replace; vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() })); });
  afterEach(() => vi.unstubAllGlobals());

  it("owns only the brand endpoint and submits only brand fields", async () => {
    const settings = {
      siteName: DEFAULT_SITE_SETTINGS.siteName,
      logoBackground: DEFAULT_SITE_SETTINGS.logoBackground,
      logoImage: DEFAULT_SITE_SETTINGS.logoImage,
      faviconImage: DEFAULT_SITE_SETTINGS.faviconImage,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeJsonResponse({ body: { settings } }))
      .mockResolvedValueOnce(makeJsonResponse({ body: { settings: { ...settings, siteName: "New Brand" } } }));
    vi.stubGlobal("fetch", fetchMock);
    const page = await mountAdminPage(<SettingsDirtyStateProvider><BrandSettingsPage /></SettingsDirtyStateProvider>);

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/site-settings/brand", expect.any(Object));
    for (const section of ["theme", "hero", "seo", "contact"]) expect(fetchMock.mock.calls.some(([url]) => String(url).includes(`/${section}`))).toBe(false);
    const logo = new File(["logo"], "logo.png", { type: "image/png" });
    const favicon = new File(["icon"], "icon.png", { type: "image/png" });
    for (const [id, file] of [["#logoFile", logo], ["#faviconFile", favicon]] as const) act(() => { const input = page.container.querySelector(id) as HTMLInputElement; Object.defineProperty(input, "files", { configurable: true, value: [file] }); input.dispatchEvent(new Event("change", { bubbles: true })); });
    await changeInput(page.container.querySelector("#siteName") as HTMLInputElement, "New Brand");
    await click([...page.container.querySelectorAll("button")].find((button) => button.textContent?.includes("บันทึกส่วนนี้"))!);

    const body = fetchMock.mock.calls[1]?.[1]?.body as FormData;
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/admin/site-settings/brand");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("PATCH");
    expect([...body.keys()]).toEqual(["siteName", "logoBackground", "logo", "faviconFile"]);
    expect(body.get("siteName")).toBe("New Brand");
    expect(body.get("logo")).toBe(logo);
    expect(body.get("faviconFile")).toBe(favicon);
    await page.unmount();
  });
});
