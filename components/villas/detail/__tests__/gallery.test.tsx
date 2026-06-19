import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { VillaListing } from "@/lib/villas/types";
import type { GalleryItem } from "../types";
import { Gallery } from "../gallery";

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

    const markup = renderToStaticMarkup(
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

    const imageTags = markup.match(/<img\b[^>]*>/g) ?? [];

    expect(imageTags).toHaveLength(4);
    expect(imageTags[0]).toContain('loading="eager"');
    expect(imageTags[0]).toContain('fetchPriority="high"');
    expect(imageTags[0]).not.toContain("priority=");
    expect(imageTags[1]).toContain('loading="lazy"');
    expect(imageTags[2]).toContain('loading="lazy"');
    expect(imageTags[3]).toContain('loading="lazy"');
  });

  it("does not pass Next priority prop to gallery tiles", () => {
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

    const markup = renderToStaticMarkup(
      <Gallery
        items={[makeGalleryItem("cover"), makeGalleryItem("outside")]}
        listing={listing}
        onImageClick={() => undefined}
        onImageError={() => undefined}
        totalImageCount={2}
      />,
    );

    expect(markup).not.toContain("priority=");
  });

  it("renders gallery tile images through the villa image display proxy", () => {
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

    const markup = renderToStaticMarkup(
      <Gallery
        items={[makeGalleryItem("cover"), makeGalleryItem("outside")]}
        listing={listing}
        onImageClick={() => undefined}
        onImageError={() => undefined}
        totalImageCount={2}
      />,
    );

    const imageSrc = markup.match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1] ?? "";
    const imageUrl = new URL(imageSrc.replaceAll("&amp;", "&"), "https://example.com");

    expect(imageUrl.pathname).toBe("/api/villas/88/images");
    expect(imageUrl.searchParams.get("url")).toBe("https://cdn.test/cover.jpg");
    expect(imageUrl.searchParams.get("w")).toBe("828");
    expect(imageUrl.searchParams.get("q")).toBe("60");
  });

  it("does not invoke the villa image display proxy for unsafe image URLs", () => {
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

    const markup = renderToStaticMarkup(
      <Gallery
        items={[unsafeItem]}
        listing={listing}
        onImageClick={() => undefined}
        onImageError={() => undefined}
        totalImageCount={1}
      />,
    );

    expect(markup).not.toContain("/api/villas/89/images");
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
