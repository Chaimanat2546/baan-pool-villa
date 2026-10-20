/** @vitest-environment jsdom */
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { click, mountAdminPage } from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { AdvertisementImagesEditor, type DraftImage } from "../advertisement-images-editor";

const images: DraftImage[] = ["a", "b", "c"].map(key => ({ key, id: key, url: `/images/${key}.webp` }));
function Harness({ disabled = false }: { disabled?: boolean }) {
  const [draft, setDraft] = useState(images);
  return <AdvertisementImagesEditor images={draft} disabled={disabled} onChange={setDraft} onError={vi.fn()} onObjectUrl={vi.fn()} />;
}
function action(container: HTMLElement, label: string) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(b => b.getAttribute("aria-label") === label || b.textContent === label)!;
}
function order(container: HTMLElement) {
  return Array.from(container.querySelectorAll("ol img")).map(img => img.getAttribute("src"));
}
describe("advertisement image selection", () => {
  it("disables adding images at two and lets an older oversized gallery be reduced", async () => {
    const page = await mountAdminPage(<Harness />);
    expect(page.container.textContent).toContain("3/2");
    expect(action(page.container, "เพิ่มรูป").disabled).toBe(true);
    await click(action(page.container, "ลบรูป"));
    expect(page.container.textContent).toContain("2/2");
    expect(action(page.container, "เพิ่มรูป").disabled).toBe(true);
    await click(action(page.container, "ลบรูป"));
    expect(action(page.container, "เพิ่มรูป").disabled).toBe(false);
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
    expect(action(page.container, "ลบรูป").disabled).toBe(true);
    expect(action(page.container, "เพิ่มรูป").disabled).toBe(false);
    await page.unmount();
  });
  it("locks selection and image actions during a save", async () => {
    const page = await mountAdminPage(<Harness disabled />);
    for (const label of ["เลือกรูปที่ 2", "เพิ่มรูป", "เลื่อนรูปไปถัดไป", "ลบรูป"]) {
      expect(action(page.container, label)?.disabled).toBe(true);
    }
    expect(order(page.container)).toEqual(["/images/a.webp", "/images/b.webp", "/images/c.webp"]);
    await page.unmount();
  });
});
