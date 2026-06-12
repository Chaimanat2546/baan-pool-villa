import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { VillaListing } from "@/lib/villas/types";
import type { GalleryItem } from "../types";
import { Gallery } from "../gallery";

interface MockImageProps {
  alt?: string;
  src?: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "auto" | "high" | "low";
}

const imageProps: Array<MockImageProps> = [];

vi.mock("next/image", () => ({
  default: (props: MockImageProps) => {
    imageProps.push(props);
    return <span data-gallery-image={props.alt} data-src={props.src} />;
  },
}));

function makeGalleryItem(key: string): GalleryItem {
  return {
    key,
    url: `https://cdn.test/${key}.jpg`,
    caption: null,
    isCover: key === "cover",
    imageName: `${key}.jpg`,
    isMock: false,
    zone: key,
    zoneLabel: key,
    zoneKey: key,
  };
}

describe("Gallery", () => {
  it("uses eager loading and high fetch priority for the main image", () => {
    imageProps.length = 0;
    const listing: VillaListing = {
      id: "66",
      zone: "jomtien",
      zoneLabel: "Jomtien",
      bedrooms: 4,
      bathrooms: 3,
      distanceToSea: "500m",
      price: 12000,
      people: 12,
      coverImage: null,
      amenities: [],
      poolType: "private",
    };

    renderToStaticMarkup(
      <Gallery
        items={[
          makeGalleryItem("cover"),
          makeGalleryItem("outside"),
          makeGalleryItem("inside"),
          makeGalleryItem("review"),
          makeGalleryItem("pool"),
        ]}
        listing={listing}
        onImageClick={() => undefined}
        onImageError={() => undefined}
        totalImageCount={5}
      />,
    );

    expect(imageProps.length).toBe(4);
    expect(imageProps[0]?.loading).toBe("eager");
    expect(imageProps[0]?.fetchPriority).toBe("high");
    expect("priority" in imageProps[0]!).toBe(false);
    expect(imageProps[1]?.loading).toBe("lazy");
    expect(imageProps[2]?.loading).toBe("lazy");
    expect(imageProps[3]?.loading).toBe("lazy");
  });

  it("does not pass Next priority prop to gallery tiles", () => {
    imageProps.length = 0;

    const listing: VillaListing = {
      id: "77",
      zone: "jomtien",
      zoneLabel: "Jomtien",
      bedrooms: 2,
      bathrooms: 2,
      distanceToSea: "500m",
      price: 8000,
      people: 4,
      coverImage: null,
      amenities: [],
      poolType: "private",
    };

    renderToStaticMarkup(
      <Gallery
        items={[makeGalleryItem("cover"), makeGalleryItem("outside")]}
        listing={listing}
        onImageClick={() => undefined}
        onImageError={() => undefined}
        totalImageCount={2}
      />,
    );

    imageProps.forEach((props) => {
      expect("priority" in props).toBe(false);
    });
  });

  it("renders gallery tile images through the villa image display proxy", () => {
    imageProps.length = 0;

    const listing: VillaListing = {
      id: "88",
      zone: "jomtien",
      zoneLabel: "Jomtien",
      bedrooms: 2,
      bathrooms: 2,
      distanceToSea: "500m",
      price: 8000,
      people: 4,
      coverImage: null,
      amenities: [],
      poolType: "private",
    };

    renderToStaticMarkup(
      <Gallery
        items={[makeGalleryItem("cover"), makeGalleryItem("outside")]}
        listing={listing}
        onImageClick={() => undefined}
        onImageError={() => undefined}
        totalImageCount={2}
      />,
    );

    const imageUrl = new URL(imageProps[0]?.src ?? "", "https://example.com");

    expect(imageUrl.pathname).toBe("/api/villas/88/images/proxy");
    expect(imageUrl.searchParams.get("url")).toBe("https://cdn.test/cover.jpg");
  });

  it("does not invoke the villa image display proxy for unsafe image URLs", () => {
    imageProps.length = 0;

    const listing: VillaListing = {
      id: "89",
      zone: "jomtien",
      zoneLabel: "Jomtien",
      bedrooms: 2,
      bathrooms: 2,
      distanceToSea: "500m",
      price: 8000,
      people: 4,
      coverImage: null,
      amenities: [],
      poolType: "private",
    };
    const unsafeItem = makeGalleryItem("cover");
    unsafeItem.url = "http://cdn.test/cover.jpg";

    renderToStaticMarkup(
      <Gallery
        items={[unsafeItem]}
        listing={listing}
        onImageClick={() => undefined}
        onImageError={() => undefined}
        totalImageCount={1}
      />,
    );

    expect(imageProps[0]?.src).not.toContain("/api/villas/89/images/proxy");
    expect(imageProps[0]?.src).toMatch(/^data:image\//);
  });

  it("reserves side tile slots when only the cover image is available", () => {
    const listing: VillaListing = {
      id: "99",
      zone: "jomtien",
      zoneLabel: "Jomtien",
      bedrooms: 2,
      bathrooms: 2,
      distanceToSea: "500m",
      price: 8000,
      people: 4,
      coverImage: null,
      amenities: [],
      poolType: "private",
    };

    const markup = renderToStaticMarkup(
      <Gallery
        items={[makeGalleryItem("cover")]}
        listing={listing}
        onImageClick={() => undefined}
        onImageError={() => undefined}
        totalImageCount={1}
      />,
    );

    expect(markup.match(/data-gallery-reserved-slot="true"/g) ?? []).toHaveLength(3);
  });
});
