/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeInput, click, makeJsonResponse, mountAdminPage } from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";

const mocks = vi.hoisted(() => ({ readAdminAccessToken: vi.fn(), router: { replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/components/admin/admin-auth", () => ({ readAdminAccessToken: mocks.readAdminAccessToken }));

import { SettingsDirtyStateProvider } from "../settings-dirty-state";
import { SeoSettingsPage } from "../seo-settings-page";

describe("SeoSettingsPage", () => {
  beforeEach(() => mocks.readAdminAccessToken.mockResolvedValue("token"));
  afterEach(() => vi.unstubAllGlobals());

  it("owns only the SEO endpoint and submits only SEO multipart fields", async () => {
    const settings = { seo: DEFAULT_SITE_SETTINGS.seo, pageSeo: DEFAULT_SITE_SETTINGS.pageSeo };
    const fetchMock = vi.fn().mockResolvedValueOnce(makeJsonResponse({ body: { settings } })).mockResolvedValueOnce(makeJsonResponse({ body: { settings: { ...settings, seo: { ...settings.seo, title: "SEO ใหม่" } } } }));
    vi.stubGlobal("fetch", fetchMock);
    const page = await mountAdminPage(<SettingsDirtyStateProvider><SeoSettingsPage /></SettingsDirtyStateProvider>);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/site-settings/seo", expect.any(Object));
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/contact"))).toBe(false);
    await changeInput(page.container.querySelector("#seoTitle") as HTMLInputElement, "SEO ใหม่");
    await click([...page.container.querySelectorAll("button")].find((button) => button.textContent?.includes("บันทึกส่วนนี้"))!);
    const body = fetchMock.mock.calls[1]?.[1]?.body as FormData;
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/admin/site-settings/seo");
    expect([...body.keys()]).not.toEqual(expect.arrayContaining(["phoneContacts", "messengerUrl", "lineId", "lineUrl", "bankAccountName", "bankName", "bankAccountNumber"]));
    await page.unmount();
  });
});
