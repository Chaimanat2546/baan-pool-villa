import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { GalleryItem } from "../types";
import { GalleryImage, GalleryReservedTile } from "../gallery-tiles";

interface MockImageProps {
  alt?: string;
  src?: string;
}

const imageProps: MockImageProps[] = [];

vi.mock("next/image", () => ({
  default: (props: MockImageProps) => {
    imageProps.push(props);
    return <span data-gallery-image={props.alt} data-src={props.src} />;
  },
}));

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
    imageProps.length = 0;

    renderToStaticMarkup(
      <GalleryImage
        alt="Pool"
        item={galleryItem()}
        listingId="88"
        onError={() => undefined}
      />,
    );

    const imageUrl = new URL(imageProps[0]?.src ?? "", "https://example.com");

    expect(imageUrl.pathname).toBe("/api/villas/88/images");
    expect(imageUrl.searchParams.get("url")).toBe("https://cdn.test/pool.jpg");
    expect(imageProps[0]?.alt).toBe("Pool");
  });

  it("renders reserved tiles with stable markers", () => {
    const reservedMarkup = renderToStaticMarkup(
      <GalleryReservedTile className="aspect-[4/3]" />,
    );

    expect(reservedMarkup).toContain('data-gallery-reserved-slot="true"');
  });
});
