/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeInput, click, makeJsonResponse, mountAdminPage } from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";

const mocks = vi.hoisted(() => ({ readAdminAccessToken: vi.fn(), replace: vi.fn(), router: { replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/components/admin/admin-auth", () => ({ readAdminAccessToken: mocks.readAdminAccessToken }));
import { SettingsDirtyStateProvider } from "../settings-dirty-state";
import { ThemeSettingsPage } from "../theme-settings-page";

const settings = Object.fromEntries(["primaryColor", "accentColor", "headerLinkColor", "headerLinkHoverColor", "footerLinkColor", "footerLinkHoverColor", "bankHighlightColor", "bankAccountHighlightColor", "bankNameHighlightColor", "bankNumberHighlightColor"].map((key) => [key, DEFAULT_SITE_SETTINGS[key as keyof typeof DEFAULT_SITE_SETTINGS]]));

describe("ThemeSettingsPage", () => {
  beforeEach(() => { mocks.readAdminAccessToken.mockResolvedValue("token"); mocks.router.replace = mocks.replace; });
  afterEach(() => vi.unstubAllGlobals());
  it("owns only the theme endpoint and submits only theme fields", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(makeJsonResponse({ body: { settings } })).mockResolvedValueOnce(makeJsonResponse({ body: { settings: { ...settings, primaryColor: "#112233" } } }));
    vi.stubGlobal("fetch", fetchMock);
    const page = await mountAdminPage(<SettingsDirtyStateProvider><ThemeSettingsPage /></SettingsDirtyStateProvider>);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/site-settings/theme", expect.any(Object));
    for (const section of ["brand", "hero", "seo", "contact"]) expect(fetchMock.mock.calls.some(([url]) => String(url).includes(`/${section}`))).toBe(false);
    await changeInput(page.container.querySelector("#primaryColor") as HTMLInputElement, "#112233");
    await click([...page.container.querySelectorAll("button")].find((button) => button.textContent?.includes("บันทึกส่วนนี้"))!);
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/admin/site-settings/theme");
    expect(Object.keys(body)).toEqual(Object.keys(settings));
    expect(body.primaryColor).toBe("#112233");
    await page.unmount();
  });
});
