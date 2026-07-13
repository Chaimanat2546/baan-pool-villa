/** @vitest-environment jsdom */
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeInput, click, makeJsonResponse, mountAdminPage } from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";

const mocks = vi.hoisted(() => ({ readAdminAccessToken: vi.fn(), replace: vi.fn(), router: { replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/components/admin/admin-auth", () => ({ readAdminAccessToken: mocks.readAdminAccessToken }));
import { SettingsDirtyStateProvider } from "../settings-dirty-state";
import { HeroSettingsPage } from "../hero-settings-page";

describe("HeroSettingsPage", () => {
  beforeEach(() => { mocks.readAdminAccessToken.mockResolvedValue("token"); mocks.router.replace = mocks.replace; vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:hero"), revokeObjectURL: vi.fn() })); });
  afterEach(() => vi.unstubAllGlobals());
  it("owns only the hero endpoint and submits only hero fields", async () => {
    const settings = { heroImage: DEFAULT_SITE_SETTINGS.heroImage };
    const fetchMock = vi.fn().mockResolvedValueOnce(makeJsonResponse({ body: { settings } })).mockResolvedValueOnce(makeJsonResponse({ body: { settings: { heroImage: { ...settings.heroImage, alt: "New hero alt" } } } }));
    vi.stubGlobal("fetch", fetchMock);
    const page = await mountAdminPage(<SettingsDirtyStateProvider><HeroSettingsPage /></SettingsDirtyStateProvider>);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/site-settings/hero", expect.any(Object));
    for (const section of ["brand", "theme", "seo", "contact"]) expect(fetchMock.mock.calls.some(([url]) => String(url).includes(`/${section}`))).toBe(false);
    const hero = new File(["hero"], "hero.webp", { type: "image/webp" });
    act(() => { const input = page.container.querySelector("#heroFile") as HTMLInputElement; Object.defineProperty(input, "files", { configurable: true, value: [hero] }); input.dispatchEvent(new Event("change", { bubbles: true })); });
    await changeInput(page.container.querySelector("#heroImageAlt") as HTMLInputElement, "New hero alt");
    await click([...page.container.querySelectorAll("button")].find((button) => button.textContent?.includes("บันทึกส่วนนี้"))!);
    const body = fetchMock.mock.calls[1]?.[1]?.body as FormData;
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/admin/site-settings/hero");
    expect([...body.keys()]).toEqual(["heroImageAlt", "hero"]);
    expect(body.get("heroImageAlt")).toBe("New hero alt");
    expect(body.get("hero")).toBe(hero);
    await page.unmount();
  });
});
