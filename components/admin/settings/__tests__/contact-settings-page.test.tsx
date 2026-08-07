/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeInput, click, makeJsonResponse, mountAdminPage } from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { DEFAULT_SITE_CONTACT_SETTINGS } from "@/lib/site-contact-settings/defaults";

const mocks = vi.hoisted(() => ({ readAdminAccessToken: vi.fn(), router: { replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/components/admin/admin-auth", () => ({ readAdminAccessToken: mocks.readAdminAccessToken }));

import { SettingsDirtyStateProvider } from "../settings-dirty-state";
import { ContactSettingsPage } from "../contact-settings-page";

describe("ContactSettingsPage", () => {
  beforeEach(() => mocks.readAdminAccessToken.mockResolvedValue("token"));
  afterEach(() => vi.unstubAllGlobals());

  it("owns only the contact endpoint and submits only contact JSON fields", async () => {
    const settings = DEFAULT_SITE_CONTACT_SETTINGS;
    const fetchMock = vi.fn().mockResolvedValueOnce(makeJsonResponse({ body: { settings } })).mockResolvedValueOnce(makeJsonResponse({ body: { settings: { ...settings, bank: { ...settings.bank, accountName: "ชื่อใหม่" } } } }));
    vi.stubGlobal("fetch", fetchMock);
    const page = await mountAdminPage(<SettingsDirtyStateProvider><ContactSettingsPage /></SettingsDirtyStateProvider>);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/site-settings/contact", expect.any(Object));
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/seo"))).toBe(false);
    const timelineSwitch = page.container.querySelector('input[aria-label="แสดง Facebook Timeline"]') as HTMLInputElement;
    expect(timelineSwitch).not.toBeNull();
    await click(timelineSwitch);
    await changeInput(page.container.querySelector("#bankAccountName") as HTMLInputElement, "ชื่อใหม่");
    await click([...page.container.querySelectorAll("button")].find((button) => button.textContent?.includes("บันทึกส่วนนี้"))!);
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/admin/site-settings/contact");
    expect(body).not.toEqual(expect.objectContaining({ seoTitle: expect.anything() }));
    expect(Object.keys(body).sort()).toEqual(["bankAccountName", "bankAccountNumber", "bankName", "lineId", "lineUrl", "messengerUrl", "phoneContacts", "showFacebookTimeline"].sort());
    expect(body.showFacebookTimeline).toBe(false);
    expect(page.container.querySelector('input[aria-label="แสดง Facebook Timeline"]')).not.toBeNull();
    expect(page.container.textContent).toContain("ข้อมูลบัญชีธนาคาร");
    expect(page.container.textContent).toContain("ช่องทางแชตและโซเชียล");
    const addButton = [...page.container.querySelectorAll("button")].find((button) => button.textContent?.includes("เพิ่มผู้ติดต่อ"));
    expect(addButton?.getAttribute("type")).toBe("button");
    expect(addButton?.className).toContain("focus:ring-2");
    expect(page.container.textContent).toContain("ลบผู้ติดต่อ");
    await page.unmount();
  });

  it("uses the original realistic bank preview fallbacks", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeJsonResponse({ body: { settings: { bank: { accountName: "", bankName: "", accountNumber: "" }, contact: DEFAULT_SITE_CONTACT_SETTINGS.contact } } })));
    const page = await mountAdminPage(<SettingsDirtyStateProvider><ContactSettingsPage /></SettingsDirtyStateProvider>);
    expect(page.container.textContent).toContain("คุณ อาภัสรา จินดาวา");
    expect(page.container.textContent).toContain("ธนาคารกสิกรไทย");
    expect(page.container.textContent).toContain("398-289-7482");
    await page.unmount();
  });
});
