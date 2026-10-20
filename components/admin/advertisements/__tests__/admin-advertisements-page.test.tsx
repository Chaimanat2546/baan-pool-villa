/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import {
  changeInput,
  click,
  flushEffects,
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
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function editButton(container: HTMLElement) {
  return container.querySelector<HTMLButtonElement>(`button[aria-label="แก้ไขโฆษณา ${ad.title}"]`)!;
}
async function mountAdvertisements() {
  let page: Awaited<ReturnType<typeof mountAdminPage>>;
  await act(async () => {
    page = await mountAdminPage(<AdminAdvertisementsPage />);
  });
  return page!;
}
describe("advertisement editor", () => {
  it("returns to a valid filtered page when saving removes its last matching record", async () => {
    let saved = false;
    const calls: URL[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input, "https://example.com");
      calls.push(url);
      if (init?.method === "POST") {
        saved = true;
        return makeJsonResponse({ body: { updatedAt: ad.updatedAt, images: ad.images } });
      }
      const currentPage = url.searchParams.get("page");
      return makeJsonResponse({ body: {
        advertisements: saved ? (currentPage === "2" ? [] : [{ ...ad, title: "ยังเปิดแสดง" }]) : [ad],
        total: saved ? 8 : 9,
      } });
    }));
    const page = await mountAdvertisements();
    const status = page.container.querySelectorAll("select")[1];
    await act(async () => { status.value = "active"; status.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => {
      page.container.querySelector('form[aria-label="ค้นหาและกรองโฆษณา"]')!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await flushEffects();
    });
    await act(async () => { await click(Array.from(page.container.querySelectorAll("button")).find(button => button.textContent === "ถัดไป")!); });
    await click(editButton(page.container));
    await click(page.container.querySelector('input[type="checkbox"]')!);
    await act(async () => { await click(page.container.querySelector('button[type="submit"]')!); await flushEffects(); });
    await click(page.container.querySelector('button[aria-label="กลับรายการโฆษณา"]')!);
    expect(page.container.querySelector("table")?.textContent).toContain("ยังเปิดแสดง");
    expect(calls.at(-1)?.searchParams.get("page")).toBe("1");
    expect(calls.at(-1)?.searchParams.get("status")).toBe("active");
    await page.unmount();
  });
  it("applies database filters at page one and keeps them when paging and returning from Edit", async () => {
    const calls: URL[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      calls.push(new URL(input, "https://example.com"));
      return makeJsonResponse({ body: { advertisements: [ad], total: 9 } });
    }));
    const page = await mountAdvertisements();
    const search = page.container.querySelector<HTMLInputElement>('input[type="search"]')!;
    await changeInput(search, " เที่ยว ");
    const filterForm = page.container.querySelector('form[aria-label="ค้นหาและกรองโฆษณา"]')!;
    act(() => filterForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    await flushEffects();
    expect(calls.at(-1)?.searchParams.get("search")).toBe("เที่ยว");
    expect(calls.at(-1)?.searchParams.get("page")).toBe("1");
    await click(Array.from(page.container.querySelectorAll("button")).find(button => button.textContent === "ถัดไป")!);
    expect(calls.at(-1)?.searchParams.get("page")).toBe("2");
    expect(calls.at(-1)?.searchParams.get("search")).toBe("เที่ยว");
    await click(editButton(page.container));
    await click(page.container.querySelector('button[aria-label="กลับรายการโฆษณา"]')!);
    expect(page.container.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe("เที่ยว");
    expect(page.container.textContent).toContain("หน้า 2 / 2");
    await page.unmount();
  });
  it("keeps an uploaded non-cover image selected after saving it", async () => {
    vi.stubGlobal("fetch", makeFetchMock([
      { url: "/api/admin/advertisements?page=1", body: { advertisements: [ad], total: 1 } },
      { url: "/api/admin/advertisements", method: "POST", body: { updatedAt: ad.updatedAt, images: [{ id: ad.images[0].id }, { id: "20000000-0000-4000-8000-000000000002" }] } },
    ]));
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = vi.fn(() => "blob:test-selected");
      static revokeObjectURL = vi.fn();
    });
    const page = await mountAdvertisements();
    await click(editButton(page.container));
    const fileInput = page.container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(fileInput, "files", { configurable: true, value: [new File(["image"], "ad.webp", { type: "image/webp" })] });
    act(() => fileInput.dispatchEvent(new Event("change", { bubbles: true })));
    await flushEffects();
    await click(page.container.querySelector('button[aria-label="เลือกรูปที่ 2"]')!);
    await act(async () => {
      await click(page.container.querySelector('button[type="submit"]')!);
      await flushEffects();
    });
    expect(page.container.textContent).toContain("บันทึกแล้ว");
    expect(page.container.querySelector('button[aria-label="เลือกรูปที่ 2"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(page.container.textContent).not.toContain("ยังไม่อัปโหลด");
    await page.unmount();
  });
  it("starts in the table and opens the chosen record only when editing", async () => {
    vi.stubGlobal("fetch", makeFetchMock([{url: "/api/admin/advertisements?page=1", body: { advertisements: [ad], total: 1 }}]));
    const page = await mountAdvertisements();
    expect(page.container.querySelector("table")).not.toBeNull();
    expect(page.container.querySelector('form[aria-label="ฟอร์มโฆษณา"]')).toBeNull();
    await click(editButton(page.container));
    expect(page.container.querySelector("table")).toBeNull();
    expect(page.container.querySelector<HTMLInputElement>('input[name="title"]')?.value).toBe(ad.title);
    await changeInput(page.container.querySelector('input[name="title"]')!, "ยังไม่บันทึก");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const back = page.container.querySelector<HTMLButtonElement>('button[aria-label="กลับรายการโฆษณา"]')!;
    await click(back);
    expect(confirm).toHaveBeenCalledOnce();
    expect(page.container.querySelector<HTMLInputElement>('input[name="title"]')?.value).toBe("ยังไม่บันทึก");
    confirm.mockReturnValue(true);
    await click(Array.from(page.container.querySelectorAll<HTMLButtonElement>("button")).find(button => button.textContent === "ยกเลิก")!);
    expect(page.container.querySelector("table")).not.toBeNull();
    expect(page.container.querySelector('form[aria-label="ฟอร์มโฆษณา"]')).toBeNull();
    await page.unmount();
  });
  it("locks record selection while a reload is pending", async () => {
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
    const page = await mountAdvertisements();
    await click(
      Array.from(page.container.querySelectorAll("button")).find(
        (button) => button.textContent === "โหลดใหม่",
      )!,
    );
    expect(
      editButton(page.container)?.disabled,
    ).toBe(true);
    expect(
      page.container.querySelector<HTMLButtonElement>('[data-create-advertisement]')
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
    const page = await mountAdvertisements();
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
    const page = await mountAdvertisements();
    await click(editButton(page.container));
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
