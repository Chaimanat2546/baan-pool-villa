/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { click, flushEffects, makeJsonResponse, mountAdminPage } from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { useAdvertisementRail } from "../use-advertisement-rail";
import type { PublicAdvertisement } from "@/lib/advertisements/types";

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const image = `/api/advertisements/images/${id(50)}`;
const ads: PublicAdvertisement[] = Array.from({ length: 8 }, (_, i) => ({ id: id(i + 1), title: `กิจกรรม ${i + 1}`, imageUrl: image, imageUrls: [image] }));
function Harness({ zone = "pattaya", visible = ads, index = 4 }: { zone?: string; visible?: PublicAdvertisement[]; index?: number }) {
  const rail = useAdvertisementRail(ads, `7:${id(8)}`, zone);
  return <><button onClick={() => rail.onActiveIndexChange(index, visible)}>เลื่อนไปท้าย</button><button onClick={() => void rail.loadMore()}>ลองใหม่</button>{rail.error && <p role="alert">โหลดไม่ได้</p>}<ul>{rail.items.map(item => <li key={item.id} data-id={item.id} data-active={rail.activeIds.has(item.id)}>{item.title}</li>)}</ul></>;
}
afterEach(() => vi.unstubAllGlobals());
describe("advertisement rail pagination", () => {
  it("activates the last visible image and continues after earlier broken cards were removed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse({ body: { advertisements: [], nextCursor: null } }));
    vi.stubGlobal("fetch", fetchMock);
    const page = await mountAdminPage(<Harness visible={ads.slice(2)} index={3} />);
    await click(page.container.querySelector("button")!);
    expect(page.container.querySelector(`[data-id="${id(8)}"]`)?.getAttribute("data-active")).toBe("true");
    expect(fetchMock).toHaveBeenCalledOnce();
    await page.unmount();
  });
  it("continues global ads without sending an invalid missing catalog zone", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse({ body: { advertisements: [], nextCursor: null } }));
    vi.stubGlobal("fetch", fetchMock);
    const page = await mountAdminPage(<Harness zone="unknown" />);
    await click(page.container.querySelector("button")!);
    expect(new URL(String(fetchMock.mock.calls[0][0]), "https://example.com").searchParams.has("zone")).toBe(false);
    await page.unmount();
  });
  it("defers the next page until scrolling, preserves existing cards on errors, and retries without duplicates", async () => {
    const ninth = { ...ads[0], id: id(9), title: "กิจกรรม 9" };
    const fetchMock = vi.fn().mockResolvedValueOnce(makeJsonResponse({ status: 503, body: {} }))
      .mockResolvedValueOnce(makeJsonResponse({ body: { advertisements: [ads[7], ninth], nextCursor: null } }));
    vi.stubGlobal("fetch", fetchMock);
    const page = await mountAdminPage(<Harness />);
    expect(fetchMock).not.toHaveBeenCalled();
    await click(page.container.querySelector("button")!);
    await flushEffects();
    expect(page.container.querySelectorAll("li")).toHaveLength(8);
    expect(page.container.querySelector('[role="alert"]')).not.toBeNull();
    await click(page.container.querySelectorAll("button")[1]);
    await flushEffects();
    expect(page.container.querySelectorAll("li")).toHaveLength(9);
    expect(page.container.textContent).toContain("กิจกรรม 9");
    expect(page.container.querySelector('[role="alert"]')).toBeNull();
    const params = new URL(String(fetchMock.mock.calls[0][0]), "https://example.com").searchParams;
    expect(params.get("zone")).toBe("pattaya");
    expect(params.get("after")).toBe(`7:${id(8)}`);
    await click(page.container.querySelectorAll("button")[1]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await page.unmount();
  });
  it("does not issue duplicate requests while a page is pending", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => { void input; void init; return new Promise<Response>(() => {}); });
    vi.stubGlobal("fetch", fetchMock);
    const page = await mountAdminPage(<Harness />);
    await click(page.container.querySelector("button")!);
    await click(page.container.querySelector("button")!);
    expect(fetchMock).toHaveBeenCalledOnce();
    const signal = fetchMock.mock.calls[0][1]!.signal!;
    await page.unmount();
    expect(signal.aborted).toBe(true);
  });
});
