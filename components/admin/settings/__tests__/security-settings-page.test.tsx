/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountAdminPage } from "@/components/admin/__tests__/admin-page-dom-test-utils";

vi.mock("@/components/admin/admin-auth", () => ({ readAdminAccessToken: vi.fn().mockResolvedValue(null) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
import { SecuritySettingsPage } from "../security-settings-page";

describe("SecuritySettingsPage", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("composes password security without loading or saving site settings", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const page = await mountAdminPage(<SecuritySettingsPage />);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("site-settings"))).toBe(false);
    expect(page.container.textContent).toContain("เปลี่ยนรหัสผ่าน");
    expect(page.container.textContent).not.toContain("บันทึกส่วนนี้");
    await page.unmount();
  });
});
