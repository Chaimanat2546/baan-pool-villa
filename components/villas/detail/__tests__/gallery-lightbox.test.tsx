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

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
