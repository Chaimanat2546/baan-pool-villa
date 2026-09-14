/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SITE_WEB_STYLES } from "@/lib/site-web-styles/defaults";
import { LazyCategorizedImages } from "../lazy-categorized-images";
import type { GalleryCategory, GalleryItem } from "../types";

const pool: GalleryItem = {
  key: "pool-1", url: "/api/villas/88/images?imageId=1", caption: "สระว่ายน้ำ",
  imageName: "pool.jpg", isCover: false, isMock: false,
  zone: "pool", zoneKey: "pool", zoneLabel: "สระว่ายน้ำ",
};
const categories: GalleryCategory[] = [
  { key: "pool", label: "สระว่ายน้ำ", items: [pool, { ...pool, key: "pool-2", url: "/api/villas/88/images?imageId=2" }] },
  { key: "bedroom", label: "ห้องนอน", items: [{ ...pool, key: "bedroom", zoneKey: "bedroom", url: "/api/villas/88/images?imageId=3" }] },
];

describe("LazyCategorizedImages", () => {
  let container: HTMLDivElement;
  let root: Root;
  let reveal: () => void;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) {
        reveal = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      observe() {}
      disconnect() {}
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function render(previewCategories = categories) {
    await act(async () => root.render(
      <LazyCategorizedImages listingId="88" previewCategories={previewCategories}
        galleryStyle={DEFAULT_SITE_WEB_STYLES.gallery} />,
    ));
  }

  it("defers image bytes until nearby, then opens and navigates only the selected category", async () => {
    await render();
    expect(container.querySelector("img")).toBeNull();
    await act(async () => reveal());
    expect(container.querySelectorAll("img")).toHaveLength(2);
    const button = container.querySelector<HTMLButtonElement>('button[aria-label="ดูรูปหมวดสระว่ายน้ำ"]');
    expect(button).not.toBeNull();
    button!.focus();
    await act(async () => button!.click());
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const closeButton = dialog!.querySelector('[aria-label="ปิดแกลเลอรี"]');
    expect(document.activeElement).toBe(closeButton);
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true })));
    expect(document.activeElement).toBe(dialog!.querySelector('[data-gallery-thumbnail-strip] button:last-child'));
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", cancelable: true })));
    expect(document.activeElement).toBe(closeButton);
    expect(dialog!.querySelectorAll('[data-gallery-thumbnail-strip] button')).toHaveLength(2);
    expect(decodeURIComponent(dialog!.querySelector('img')?.getAttribute("src") ?? "")).toContain("imageId=1");
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" })));
    expect(decodeURIComponent(dialog!.querySelector('img')?.getAttribute("src") ?? "")).toContain("imageId=2");
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("keeps a failed preview usable and allows navigation past a failed full image", async () => {
    await render();
    await act(async () => reveal());
    await act(async () => container.querySelector("img")!.dispatchEvent(new Event("error")));
    expect(container.textContent).toContain("ไม่สามารถโหลดรูปได้");
    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" })));
    expect(decodeURIComponent(document.querySelector('[role="dialog"] img')?.getAttribute("src") ?? "")).toContain("imageId=2");
    await act(async () => document.querySelector('[role="dialog"] img')!.dispatchEvent(new Event("error")));
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('[role="dialog"] img')).toBeNull();
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="ปิดแกลเลอรี"]')!.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("omits empty categories", async () => {
    await render([{ key: "empty", label: "ว่าง", items: [] }]);
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });
});

