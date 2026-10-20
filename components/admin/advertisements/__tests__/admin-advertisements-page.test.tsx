/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeInput,
  click,
  makeFetchMock,
  makeJsonResponse,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { AdminAdvertisementsPage } from "../admin-advertisements-page";
const mocks = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks }));
vi.mock("@/components/admin/admin-auth", () => ({
  readAdminAccessToken: async () => "token",
}));
const id = "10000000-0000-4000-8000-000000000001";
const ad = {
  id,
  title: "เที่ยวทะเล",
  zone: "all",
  sortOrder: 1,
  isActive: true,
  updatedAt: "2026-10-20T12:00:00Z",
  images: [
    {
      id: "20000000-0000-4000-8000-000000000001",
      storagePath: "",
      url: "https://tenant.supabase.co/a.webp",
    },
  ],
};
beforeEach(() => {
  mocks.replace.mockReset();
});
afterEach(() => vi.unstubAllGlobals());
describe("advertisement editor", () => {
  it("locks the draft while a reload is pending so a late response cannot discard new edits", async () => {
    const first = makeJsonResponse({
      body: { advertisements: [ad], total: 1 },
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(first)
        .mockImplementation(() => new Promise(() => {})),
    );
    const page = await mountAdminPage(<AdminAdvertisementsPage />);
    await click(
      Array.from(page.container.querySelectorAll("button")).find(
        (button) => button.textContent === "โหลดใหม่",
      )!,
    );
    expect(
      page.container.querySelector<HTMLFieldSetElement>("fieldset")?.disabled,
    ).toBe(true);
    expect(
      page.container.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(true);
    await page.unmount();
  });
  it("shows an empty library with a working create action", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock([
        {
          url: "/api/admin/advertisements?page=1",
          body: { advertisements: [], total: 0 },
        },
      ]),
    );
    const page = await mountAdminPage(<AdminAdvertisementsPage />);
    expect(page.container.textContent).toContain("ยังไม่มีโฆษณา");
    await click(page.container.querySelector("[data-create-advertisement]")!);
    expect(page.container.querySelector('input[name="title"]')).not.toBeNull();
    await page.unmount();
  });
  it("keeps edits local and preserves them when save fails without redirecting on storage errors", async () => {
    const fetchMock = makeFetchMock([
      {
        url: "/api/admin/advertisements?page=1",
        body: { advertisements: [ad], total: 1 },
      },
      {
        url: "/api/admin/advertisements",
        method: "POST",
        status: 403,
        body: { error: "Storage permission denied" },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const page = await mountAdminPage(<AdminAdvertisementsPage />);
    await changeInput(
      page.container.querySelector('input[name="title"]')!,
      "หัวข้อใหม่",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await click(page.container.querySelector('button[type="submit"]')!);
    expect(
      page.container.querySelector<HTMLInputElement>('input[name="title"]')
        ?.value,
    ).toBe("หัวข้อใหม่");
    expect(page.container.querySelector('[role="alert"]')).not.toBeNull();
    expect(mocks.replace).not.toHaveBeenCalled();
    await page.unmount();
  });
});
