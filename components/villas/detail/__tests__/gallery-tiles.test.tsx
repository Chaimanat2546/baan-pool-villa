import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GalleryItem } from "../types";
import { GalleryImage, GalleryReservedTile } from "../gallery-tiles";

function galleryItem(overrides: Partial<GalleryItem> = {}): GalleryItem {
  return {
    caption: null,
    imageName: "pool.jpg",
    isCover: false,
    isMock: false,
    key: "pool",
    url: "https://cdn.test/pool.jpg",
    zone: "pool",
    zoneKey: "pool",
    zoneLabel: "Pool",
    ...overrides,
  };
}

describe("gallery tiles", () => {
  it("renders image tiles through the display proxy", () => {
    const markup = renderToStaticMarkup(
      <GalleryImage
        alt="Pool"
        item={galleryItem()}
        listingId="88"
        onError={() => undefined}
      />,
    );

    const imageSrc = markup.match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1] ?? "";
    const imageUrl = new URL(imageSrc.replaceAll("&amp;", "&"), "https://example.com");

    expect(imageUrl.pathname).toBe("/api/villas/88/images");
    expect(imageUrl.searchParams.get("url")).toBe("https://cdn.test/pool.jpg");
    expect(markup).toContain('alt="Pool"');
  });

  it("renders reserved tiles with stable markers", () => {
    const reservedMarkup = renderToStaticMarkup(
      <GalleryReservedTile className="aspect-[4/3]" />,
    );

    expect(reservedMarkup).toContain('data-gallery-reserved-slot="true"');
  });
});
