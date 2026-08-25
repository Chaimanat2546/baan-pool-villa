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
        onViewAll={() => undefined}
        totalImageCount={5}
      />,
    );

    const imageTags = markup.match(/<img\b[^>]*>/g) ?? [];

    expect(imageTags).toHaveLength(4);
    expect(imageTags[0]).toContain('loading="eager"');
    expect(imageTags[0]).toContain('fetchPriority="high"');
    expect(imageTags[0]).toContain('sizes="(max-width: 1023px) 100vw, 60vw"');
    expect(imageTags[0]).not.toContain("priority=");
    expect(imageTags[1]).toContain('loading="lazy"');
    expect(imageTags[1]).toContain('sizes="(max-width: 1023px) 28vw, 20vw"');
    expect(imageTags[2]).toContain('loading="lazy"');
    expect(imageTags[2]).toContain('sizes="(max-width: 1023px) 28vw, 20vw"');
    expect(imageTags[3]).toContain('loading="lazy"');
    expect(imageTags[3]).toContain('sizes="(max-width: 1023px) 28vw, 40vw"');
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
        onViewAll={() => undefined}
        totalImageCount={2}
      />,
    );

    expect(markup).not.toContain("priority=");
  });

  it("uses the overlay text token for the image-count badge", () => {
    const markup = renderToStaticMarkup(
      <Gallery
        items={["cover", "outside", "inside", "pool"].map(makeGalleryItem)}
        listing={{
          id: "78",
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
        }}
        onImageClick={() => undefined}
        onImageError={() => undefined}
        onViewAll={() => undefined}
        totalImageCount={4}
      />,
    );

    expect(markup).toContain("text-[var(--site-on-overlay)]");
    expect(markup).toContain("ดูรูปที่พัก (4)");
  });

  it("uses a count-free label until the full gallery count is known", () => {
    const markup = renderToStaticMarkup(
      <Gallery
        items={["cover", "outside", "inside", "pool"].map(makeGalleryItem)}
        listing={{
          id: "79",
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
        }}
        onImageClick={() => undefined}
        onImageError={() => undefined}
        onViewAll={() => undefined}
        totalImageCount={null}
      />,
    );

    expect(markup).toContain("ดูรูปที่พัก");
    expect(markup).not.toContain("ดูรูปที่พัก (");
  });

  it("passes gallery tile images to next/image without the villa display proxy", () => {
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
        onViewAll={() => undefined}
        totalImageCount={2}
      />,
    );

    const imageSrc = markup.match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1] ?? "";
    const decodedImageSrc = decodeURIComponent(imageSrc.replaceAll("&amp;", "&"));

    expect(decodedImageSrc).toContain("https://cdn.test/cover.jpg");
    expect(imageSrc).not.toContain("/api/villas/88/images");
  });

  it("does not render unsafe image URLs", () => {
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
        onViewAll={() => undefined}
        totalImageCount={1}
      />,
    );

    expect(markup).not.toContain("/api/villas/89/images");
    expect(markup).not.toContain("http://cdn.test/cover.jpg");
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
        onViewAll={() => undefined}
        totalImageCount={1}
      />,
    );

    expect(markup.match(/data-gallery-reserved-slot="true"/g) ?? []).toHaveLength(3);
  });
});
