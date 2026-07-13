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
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await click([...page.container.querySelectorAll("button")].find((button) => button.textContent?.includes("บันทึกส่วนนี้"))!);
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/admin/site-settings/theme");
    expect(Object.keys(body)).toEqual(Object.keys(settings));
    expect(body.primaryColor).toBe("#112233");
    await page.unmount();
  });

  it("groups each color control with its scoped draft preview", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeJsonResponse({ body: { settings } })));

    const page = await mountAdminPage(<SettingsDirtyStateProvider><ThemeSettingsPage /></SettingsDirtyStateProvider>);

    expect(page.container.querySelector(".settings-preview-theme")).not.toBeNull();
    const primaryActions = page.container.querySelector('[data-theme-color-group="primary-actions"]');
    expect(primaryActions).not.toBeNull();
    expect(primaryActions?.querySelector("#primaryColor")).not.toBeNull();
    expect(primaryActions?.querySelector("#accentColor")).not.toBeNull();
    expect(primaryActions?.querySelector('[class~="bg-[var(--site-primary)]"]')).not.toBeNull();

    const headerMenu = page.container.querySelector('[data-theme-color-group="header-menu"]');
    expect(headerMenu).not.toBeNull();
    expect(headerMenu?.querySelector("#headerLinkHoverColor")).not.toBeNull();
    expect(headerMenu?.querySelector('[class~="text-[var(--site-header-link-hover)]"]')).not.toBeNull();

    const bankDetails = page.container.querySelector('[data-theme-color-group="bank-details"]');
    expect(bankDetails).not.toBeNull();
    expect(bankDetails?.querySelector("#bankNumberHighlightColor")).not.toBeNull();
    expect(bankDetails?.querySelector('[class~="text-[var(--site-bank-number-highlight)]"]')).not.toBeNull();

    const footerMenu = page.container.querySelector('[data-theme-color-group="footer-menu"]');
    expect(footerMenu).not.toBeNull();
    expect(footerMenu?.querySelector("#footerLinkHoverColor")).not.toBeNull();
    expect(footerMenu?.querySelector('[class~="text-[var(--site-footer-link-hover)]"]')).not.toBeNull();
    await page.unmount();
  });
});
