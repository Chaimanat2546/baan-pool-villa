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

    const preview = page.container.querySelector(".settings-preview-theme") as HTMLElement;
    expect(preview).not.toBeNull();
    expect(preview.style.getPropertyValue("--site-primary")).toBe(settings.primaryColor);
    expect(preview.querySelector('link[rel="stylesheet"]')).toBeNull();
    const primaryActions = page.container.querySelector('[data-theme-color-group="primary-actions"]');
    expect(primaryActions).not.toBeNull();
    expect(primaryActions?.querySelector("#primaryColor")).not.toBeNull();
    expect(primaryActions?.querySelector("#accentColor")).not.toBeNull();
    expect(primaryActions?.querySelector('[class~="bg-[var(--site-primary)]"]')).not.toBeNull();
    expect(primaryActions?.textContent).toContain("สีพื้นหลักของเว็บไซต์");
    expect(primaryActions?.textContent).toContain("ราคาเริ่มต้น");
    expect(primaryActions?.querySelector('[class~="text-[var(--site-accent)]"]')).not.toBeNull();

    const headerMenu = page.container.querySelector('[data-theme-color-group="header-menu"]');
    expect(headerMenu).not.toBeNull();
    expect(headerMenu?.querySelector("#headerLinkHoverColor")).not.toBeNull();
    expect(headerMenu?.querySelector('[class*="hover:text-[var(--site-header-link-hover)]"]')).not.toBeNull();
    expect(headerMenu?.textContent).toContain("เดสก์ท็อป");
    expect(headerMenu?.querySelector('[class~="bg-[var(--site-surface)]"]')).not.toBeNull();
    const headerPreview = headerMenu?.querySelector('[data-theme-preview="header"]') as HTMLElement;
    expect(headerPreview).not.toBeNull();
    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
    headerPreview.dispatchEvent(clickEvent);
    const middleClickEvent = new MouseEvent("auxclick", { bubbles: true, button: 1, cancelable: true });
    headerPreview.dispatchEvent(middleClickEvent);
    const enterEvent = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" });
    headerPreview.dispatchEvent(enterEvent);
    expect(clickEvent.defaultPrevented).toBe(true);
    expect(middleClickEvent.defaultPrevented).toBe(true);
    expect(enterEvent.defaultPrevented).toBe(true);
    expect(headerMenu?.textContent).toContain("บ้านพักตัวอย่าง");
    expect(headerMenu?.textContent).not.toContain("อาภัสรา");

    const bankDetails = page.container.querySelector('[data-theme-color-group="bank-details"]');
    expect(bankDetails).not.toBeNull();
    expect(bankDetails?.querySelector("#bankNumberHighlightColor")).not.toBeNull();
    expect(bankDetails?.querySelector('[class~="text-[var(--site-bank-number-highlight)]"]')).not.toBeNull();
    expect(bankDetails?.querySelector("#bankHighlightColor")).toBeNull();
    expect(bankDetails?.textContent).toContain("Header และ Footer");
    expect(bankDetails?.querySelector('[class~="bg-[var(--site-primary)]"]')).not.toBeNull();
    expect(bankDetails?.querySelector('[class~="text-[var(--site-bank-highlight)]"]')).toBeNull();

    const footerMenu = page.container.querySelector('[data-theme-color-group="footer-menu"]');
    expect(footerMenu).not.toBeNull();
    expect(footerMenu?.querySelector("#footerLinkHoverColor")).not.toBeNull();
    expect(footerMenu?.querySelector('[class*="hover:text-[var(--site-footer-link-hover)]"]')).not.toBeNull();
    expect(footerMenu?.textContent).toContain("ลิงก์ในส่วนท้ายเว็บไซต์");
    const footerPreview = footerMenu?.querySelector('[data-theme-preview="footer"]') as HTMLElement;
    expect(footerPreview).not.toBeNull();
    const footerClickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
    footerPreview.dispatchEvent(footerClickEvent);
    expect(footerClickEvent.defaultPrevented).toBe(true);
    expect(preview.textContent).toContain("บ้านพักตัวอย่าง");
    expect(preview.textContent).toContain("คุณมินท์ ใจดี");
    expect(preview.textContent).toContain("ธนาคารตัวอย่าง");
    expect(preview.textContent).toContain("123-4-56789-0");
    expect(preview.textContent).toContain("@examplevilla");
    expect(preview.textContent).not.toContain("อาภัสรา");
    await page.unmount();
  });
});
