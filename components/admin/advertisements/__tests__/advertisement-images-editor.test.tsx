/** @vitest-environment jsdom */
import { act, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, flushEffects, mountAdminPage } from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { AdvertisementImagesEditor, type DraftImage } from "../advertisement-images-editor";

const images: DraftImage[] = ["a", "b", "c"].map(key => ({ key, id: key, url: `/images/${key}.webp` }));
function Harness({ disabled = false, initial = images, onError = vi.fn(), onObjectUrl = vi.fn() }: { disabled?: boolean; initial?: DraftImage[]; onError?: (errors: string[]) => void; onObjectUrl?: (url: string) => void }) {
  const [draft, setDraft] = useState(initial);
  return <AdvertisementImagesEditor images={draft} disabled={disabled} onChange={setDraft} onError={onError} onObjectUrl={onObjectUrl} />;
}
beforeEach(() => {
  let nextUrl = 0;
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn(() => `blob:dropped-${++nextUrl}`);
  });
});
afterEach(() => vi.unstubAllGlobals());
async function drop(container: HTMLElement, files: File[]) {
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { files, types: ["Files"] } });
  act(() => container.querySelector('section[aria-label="รูปโฆษณา"]')!.dispatchEvent(event));
  await flushEffects();
  return event;
}
function action(container: HTMLElement, label: string) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(b => b.getAttribute("aria-label") === label || b.textContent === label)!;
}
function order(container: HTMLElement) {
  return Array.from(container.querySelectorAll("ol img")).map(img => img.getAttribute("src"));
}
function uploadInput(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('input[type="file"]')!;
}
describe("advertisement image selection", () => {
  it("accepts dropped files as local drafts in their original order", async () => {
    const onObjectUrl = vi.fn();
    const page = await mountAdminPage(<Harness initial={[]} onObjectUrl={onObjectUrl} />);
    const files = [new File(["png"], "first.png", { type: "image/png" }), new File(["webp"], "second.webp", { type: "image/webp" })];
    expect((await drop(page.container, files)).defaultPrevented).toBe(true);
    expect(order(page.container)).toEqual(["blob:dropped-1", "blob:dropped-2"]);
    expect(onObjectUrl.mock.calls).toEqual([["blob:dropped-1"], ["blob:dropped-2"]]);
    expect(page.container.textContent?.match(/ยังไม่อัปโหลด/g)).toHaveLength(2);
    expect(uploadInput(page.container).disabled).toBe(true);
    await page.unmount();
  });
  it("rejects a dropped third file without replacing existing images", async () => {
    const onError = vi.fn();
    const page = await mountAdminPage(<Harness initial={images.slice(0, 2)} onError={onError} />);
    expect((await drop(page.container, [new File(["png"], "third.png", { type: "image/png" })])).defaultPrevented).toBe(true);
    expect(onError).toHaveBeenCalledWith(["เลือกรูปได้สูงสุด 2 รูป"]);
    expect(order(page.container)).toEqual(["/images/a.webp", "/images/b.webp"]);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    await page.unmount();
  });
  it.each([
    [new File(["svg"], "bad.svg", { type: "image/svg+xml" })],
    [new File([new Uint8Array(6 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })],
  ])("rejects unsupported or oversized dropped files before creating previews", async file => {
    const onError = vi.fn();
    const page = await mountAdminPage(<Harness initial={[]} onError={onError} />);
    await drop(page.container, [file]);
    expect(onError).toHaveBeenCalledWith(expect.arrayContaining([expect.any(String)]));
    expect(order(page.container)).toEqual([]);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    await page.unmount();
  });
  it("ignores drops while saving and prevents opening the dropped file", async () => {
    const onError = vi.fn();
    const page = await mountAdminPage(<Harness initial={[]} disabled onError={onError} />);
    expect((await drop(page.container, [new File(["png"], "busy.png", { type: "image/png" })])).defaultPrevented).toBe(true);
    expect(order(page.container)).toEqual([]);
    expect(onError).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    await page.unmount();
  });
  it("disables adding images at two and lets an older oversized gallery be reduced", async () => {
    const page = await mountAdminPage(<Harness />);
    expect(page.container.textContent).toContain("3/2");
    expect(uploadInput(page.container).disabled).toBe(true);
    await click(action(page.container, "ลบรูป"));
    expect(page.container.textContent).toContain("2/2");
    expect(uploadInput(page.container).disabled).toBe(true);
    await click(action(page.container, "ลบรูป"));
    expect(uploadInput(page.container).disabled).toBe(false);
    await page.unmount();
  });
  it("moves the selected image and keeps it selected when making it the cover", async () => {
    const page = await mountAdminPage(<Harness />);
    await click(action(page.container, "เลือกรูปที่ 3"));
    await click(action(page.container, "เลื่อนรูปไปก่อนหน้า"));
    expect(order(page.container)).toEqual(["/images/a.webp", "/images/c.webp", "/images/b.webp"]);
    expect(action(page.container, "เลือกรูปที่ 2").getAttribute("aria-pressed")).toBe("true");
    await click(action(page.container, "ตั้งเป็นภาพปก"));
    expect(order(page.container)).toEqual(["/images/c.webp", "/images/a.webp", "/images/b.webp"]);
    expect(action(page.container, "เลือกรูปที่ 1").getAttribute("aria-pressed")).toBe("true");
    expect(action(page.container, "ตั้งเป็นภาพปก").disabled).toBe(true);
    await page.unmount();
  });
  it("removes only the selected image and keeps controls usable through an empty gallery", async () => {
    const page = await mountAdminPage(<Harness />);
    await click(action(page.container, "เลือกรูปที่ 2"));
    await click(action(page.container, "ลบรูป"));
    expect(order(page.container)).toEqual(["/images/a.webp", "/images/c.webp"]);
    await click(action(page.container, "ลบรูป"));
    await click(action(page.container, "ลบรูป"));
    expect(order(page.container)).toEqual([]);
    expect(page.container.textContent).toContain("เพิ่มรูปอย่างน้อย 1 รูป");
    expect(page.container.querySelector('[aria-label="จัดการรูปที่เลือก"]')).toBeNull();
    expect(uploadInput(page.container).disabled).toBe(false);
    await page.unmount();
  });
  it("locks selection and image actions during a save", async () => {
    const page = await mountAdminPage(<Harness disabled />);
    for (const label of ["เลือกรูปที่ 2", "เลื่อนรูปไปถัดไป", "ลบรูป"]) {
      expect(action(page.container, label)?.disabled).toBe(true);
    }
    expect(uploadInput(page.container).disabled).toBe(true);
    expect(order(page.container)).toEqual(["/images/a.webp", "/images/b.webp", "/images/c.webp"]);
    await page.unmount();
  });
});
