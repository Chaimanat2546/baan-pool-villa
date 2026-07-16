/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { VillaListing } from "@/lib/villas/types";
import { GalleryLightbox } from "../gallery-lightbox";
import type { GalleryCategory, GalleryItem } from "../types";

vi.mock("next/image", () => ({
  default: (props: { alt?: string; src?: string }) => (
    <span data-gallery-image={props.alt} data-src={props.src} />
  ),
}));

const item: GalleryItem = {
  caption: null,
  imageName: "pool.jpg",
  isCover: false,
  isMock: false,
  key: "pool",
  url: "https://cdn.test/pool.jpg",
  zone: "pool",
  zoneKey: "pool",
  zoneLabel: "Pool",
};

const listing: VillaListing = {
  amenities: [],
  bathrooms: 2,
  bedrooms: 3,
  coverImage: null,
  distanceToSea: "500m",
  id: "88",
  people: 8,
  poolType: "private",
  price: 12000,
  zone: "jomtien",
  zoneLabel: "Jomtien",
};

const categories: GalleryCategory[] = [
  {
    items: [item],
    key: "pool",
    label: "Pool",
  },
];
const secondItem: GalleryItem = {
  ...item,
  imageName: "pool-2.jpg",
  key: "pool-2",
  url: "https://cdn.test/pool-2.jpg",
};

describe("GalleryLightbox", () => {
  it("renders nothing without an active item and renders active gallery details", () => {
    const emptyMarkup = renderToStaticMarkup(
      <GalleryLightbox
        activeItem={null}
        categories={categories}
        listing={listing}
        onClose={() => undefined}
        onImageError={() => undefined}
        onSelect={() => undefined}
      />,
    );
    const activeMarkup = renderToStaticMarkup(
      <GalleryLightbox
        activeItem={item}
        categories={categories}
        listing={listing}
        onClose={() => undefined}
        onImageError={() => undefined}
        onSelect={() => undefined}
      />,
    );

    expect(emptyMarkup).toBe("");
    expect(activeMarkup).toContain("Pool");
    expect(activeMarkup).toContain('role="dialog"');
    expect(activeMarkup).toContain('aria-modal="true"');
    expect(activeMarkup).toContain('aria-labelledby="gallery-lightbox-title-88"');
    expect(activeMarkup).toContain('id="gallery-lightbox-title-88"');
    expect(activeMarkup).toContain('data-active-thumbnail="true"');
    expect(activeMarkup).toContain("line-clamp-3 break-words");
    expect(activeMarkup).toContain("แกลเลอรีรูปบ้าน");
    expect(activeMarkup).toContain("ดาวน์โหลดรูปนี้");
  });

  it("supports an activity popup without a villa image download action", () => {
    const markup = renderToStaticMarkup(
      <GalleryLightbox
        activeItem={item}
        categories={categories}
        eyebrow="แกลเลอรีกิจกรรม"
        listing={listing}
        onClose={() => undefined}
        onImageError={() => undefined}
        onSelect={() => undefined}
        showCategorySelector={false}
        showDownload={false}
        title="Island day pass"
      />,
    );

    expect(markup).toContain("แกลเลอรีกิจกรรม");
    expect(markup).toContain("Island day pass");
    expect(markup).toContain("กิจกรรม");
    expect(markup).toContain("line-clamp-2 break-words");
    expect(markup).not.toContain("line-clamp-3 break-words");
    expect(markup).not.toContain("เลือกหมวดหมู่");
    expect(markup).not.toContain("หมวดรูป");
    expect(markup).not.toContain("ดาวน์โหลดรูปนี้");
  });

  it("keeps a categorized selection in one category with thumbnails below", () => {
    const markup = renderToStaticMarkup(
      <GalleryLightbox
        activeItem={item}
        categories={[{ ...categories[0], items: [item, secondItem] }]}
        listing={listing}
        onClose={() => undefined}
        onImageError={() => undefined}
        onSelect={() => undefined}
        showCategorySelector={false}
        thumbnailPlacement="bottom"
      />,
    );

    expect(markup).toContain('data-gallery-thumbnail-placement="bottom"');
    expect(markup).toContain('data-gallery-thumbnail-strip="bottom"');
    expect(markup).not.toContain("เลือกหมวดหมู่");
    expect(markup.match(/ดูรูปหมวดPool/g) ?? []).toHaveLength(2);
  });

  it("applies optional gallery modal colors without replacing theme fallbacks", () => {
    const markup = renderToStaticMarkup(
      <GalleryLightbox
        activeItem={item}
        categories={categories}
        listing={listing}
        onClose={() => undefined}
        onImageError={() => undefined}
        onSelect={() => undefined}
        style={{
          backgroundColor: "#123456",
          textColor: "#ffffff",
          variant: "categorized-grid",
        }}
      />,
    );

    expect(markup).toContain("--gallery-modal-background:#123456");
    expect(markup).toContain("--gallery-modal-text:#ffffff");
    expect(markup).toContain("bg-[var(--gallery-modal-background");
  });

  it("does not select an empty category", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onSelect = vi.fn();

    await act(async () => {
      root.render(
        <GalleryLightbox
          activeItem={item}
          categories={[...categories, { items: [], key: "empty", label: "Empty" }]}
          listing={listing}
          onClose={() => undefined}
          onImageError={() => undefined}
          onSelect={onSelect}
        />,
      );
    });

    const emptyCategoryButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Empty"),
    ) as HTMLButtonElement | undefined;

    expect(emptyCategoryButton).toBeDefined();

    await act(async () => {
      emptyCategoryButton?.click();
    });

    expect(onSelect).not.toHaveBeenCalled();
    expect(document.body.classList.contains("body-scroll-locked")).toBe(true);

    await act(async () => {
      root.unmount();
    });
    expect(document.body.classList.contains("body-scroll-locked")).toBe(false);
    container.remove();
  });

  it("selects the next image with the keyboard", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onSelect = vi.fn();

    await act(async () => {
      root.render(
        <GalleryLightbox
          activeItem={item}
          categories={[{ ...categories[0], items: [item, secondItem] }]}
          listing={listing}
          onClose={() => undefined}
          onImageError={() => undefined}
          onSelect={onSelect}
        />,
      );
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    });

    expect(onSelect).toHaveBeenCalledWith(secondItem);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
