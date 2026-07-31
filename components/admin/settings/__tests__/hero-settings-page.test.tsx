/** @vitest-environment jsdom */
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
  it("adds, reorders, removes and submits an ordered hero slide snapshot", async () => {
    const settings = { heroImage: DEFAULT_SITE_SETTINGS.heroImage, heroSlides: [{ ...DEFAULT_SITE_SETTINGS.heroImage, alt: "สไลด์แรก" }, { ...DEFAULT_SITE_SETTINGS.heroImage, path: "hero/two.webp", url: "/two.webp", alt: "สไลด์ที่สอง" }] };
    const fetchMock = vi.fn().mockResolvedValueOnce(makeJsonResponse({ body: { settings } })).mockResolvedValueOnce(makeJsonResponse({ body: { settings } }));
    vi.stubGlobal("fetch", fetchMock);
    const page = await mountAdminPage(<SettingsDirtyStateProvider><HeroSettingsPage /></SettingsDirtyStateProvider>);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/site-settings/hero", expect.any(Object));
    for (const section of ["brand", "theme", "seo", "contact"]) expect(fetchMock.mock.calls.some(([url]) => String(url).includes(`/${section}`))).toBe(false);
    const button = (label: string) => [...page.container.querySelectorAll("button")].find((element) => element.getAttribute("aria-label") === label)!;
    expect(page.container.textContent).toContain("สไลด์ 1");
    expect(page.container.textContent).toContain("สไลด์ 2");
    await click(button("เลื่อนสไลด์ที่ 2 ขึ้น"));
    await click(button("เพิ่มสไลด์"));
    expect(page.container.textContent).toContain("สไลด์ 3");
    await click(button("ลบสไลด์ที่ 3"));
    await changeInput(page.container.querySelector("#heroSlideAlt-0") as HTMLInputElement, "สไลด์ที่สองใหม่");
    await click([...page.container.querySelectorAll("button")].find((button) => button.textContent?.includes("บันทึกส่วนนี้"))!);
    const body = fetchMock.mock.calls[1]?.[1]?.body as FormData;
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/admin/site-settings/hero");
    expect([...body.keys()]).toEqual(["heroSlides"]);
    expect(JSON.parse(String(body.get("heroSlides")))).toEqual([
      { path: "hero/two.webp", url: "/two.webp", alt: "สไลด์ที่สองใหม่" },
      { path: settings.heroSlides[0].path, url: settings.heroSlides[0].url, alt: "สไลด์แรก" },
    ]);
    await page.unmount();
  });
});
