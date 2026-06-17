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
    expect(activeMarkup).toContain('data-active-thumbnail="true"');
  });
});
