import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { VillaListing } from "@/lib/villas/types";

import { VillaCardStyleProvider } from "../villa-card-style-context";
import { selectVillaCardGalleryImages } from "../villa-card-gallery-images";
import { VillaCard } from "../villa-card";

vi.mock("next/image", () => ({
  default: ({ alt, preload, src, ...props }: Record<string, unknown>) => (
    <span
      {...props}
      aria-label={typeof alt === "string" ? alt : undefined}
      data-preload={preload ? "true" : "false"}
      data-src={src}
    />
  ),
}));

const villa: VillaListing = {
  amenities: [],
  bathrooms: 4,
  bedrooms: 5,
  coverImage: "https://devillegroups.com/imgs/profile_imgs_large/501.jpg",
  distanceToSea: "500m",
  id: "501",
  people: 12,
  poolType: "private",
  price: 12000,
  zone: "jomtien",
  zoneLabel: "Jomtien",
};

describe("VillaCard navigation", () => {
  it("uses a normal document link for villa detail pages", () => {
    const markup = renderToStaticMarkup(<VillaCard villa={villa} />);

    expect(markup).toContain('href="/villas/501"');
    expect(markup).not.toContain("data-next-link");
  });

  it("renders listing covers through the same-origin image proxy", () => {
    const markup = renderToStaticMarkup(<VillaCard villa={villa} />);

    expect(markup).toContain('src="/api/houses/images/501"');
    expect(markup).not.toContain("devillegroups.com");
  });

  it("keeps an inactive classic cover at its progressive preview", () => {
    const markup = renderToStaticMarkup(
      <VillaCard coverImageActive={false} villa={villa} />,
    );

    expect(markup).toContain("data-progressive-preview=\"true\"");
    expect(markup).not.toContain("data-progressive-full=\"true\"");
  });

  it("renders the full classic cover when its card is active", () => {
    const markup = renderToStaticMarkup(
      <VillaCard coverImageActive villa={villa} />,
    );

    expect(markup).toContain("data-progressive-preview=\"true\"");
    expect(markup).toContain("data-progressive-full=\"true\"");
  });

  it("applies card cover activation to the selected gallery image", () => {
    const markup = renderToStaticMarkup(
      <VillaCard
        coverImageActive={false}
        villa={villa}
        villaCardStyle="gallery"
      />,
    );

    expect(markup).toContain("data-progressive-preview=\"true\"");
    expect(markup).not.toContain("data-progressive-full=\"true\"");
  });

  it("uses its server-provided style instead of the surrounding client context", () => {
    const markup = renderToStaticMarkup(
      <VillaCardStyleProvider value="gallery">
        <VillaCard villa={villa} villaCardStyle="classic" />
      </VillaCardStyleProvider>,
    );

    expect(markup).toContain('data-villa-card-style="classic"');
    expect(markup).not.toContain('data-villa-card-gallery-status="loading"');
    expect(markup).toContain('href="/villas/501"');
  });

  it("uses server-provided gallery preview images without waiting for the browser API", () => {
    const markup = renderToStaticMarkup(
      <VillaCard
        villa={{
          ...villa,
          galleryPreviewImages: [
            "https://images.example.com/pool.jpg",
            "https://images.example.com/bedroom.jpg",
          ],
        }}
        villaCardStyle="gallery"
      />,
    );

    expect(markup).toContain('data-villa-card-gallery-status="ready"');
    expect(markup).toContain('data-src="https://images.example.com/pool.jpg"');
  });

  it("shows the no-image placeholder when a card has no cover image", () => {
    const markup = renderToStaticMarkup(
      <VillaCard villa={{ ...villa, coverImage: null }} />,
    );

    expect(markup).toContain("ไม่มีรูปภาพ");
  });

  it("keeps the cover image first and caps gallery card images at ten", () => {
    const images = selectVillaCardGalleryImages(
      "https://images.example.com/cover.jpg",
      Array.from({ length: 12 }, (_, index) => ({
        imageUrl: `https://images.example.com/image-${index + 1}.jpg`,
      })),
    );

    expect(images).toHaveLength(10);
    expect(images[0]).toBe("https://images.example.com/cover.jpg");
    expect(images[9]).toBe("https://images.example.com/image-9.jpg");
  });

  it("returns no gallery card images when there are fewer than three usable images", () => {
    expect(
      selectVillaCardGalleryImages("https://images.example.com/cover.jpg", [
        {
          imageUrl: "https://images.example.com/pool.jpg",
        },
      ]),
    ).toEqual([]);
  });

  it("hides the price row when a villa has no price", () => {
    const markup = renderToStaticMarkup(
      <VillaCard villa={{ ...villa, price: null }} />,
    );

    expect(markup).toContain("hidden");
    expect(markup).not.toContain(">0<");
  });

  it("shows only short amenity labels on cards", () => {
    const markup = renderToStaticMarkup(
      <VillaCard
        villa={{
          ...villa,
          amenities: [
            { key: "wifi", label: "Wi-Fi" },
            { key: "private_pool", label: "สระว่ายน้ำส่วนตัว" },
            { key: "swimming_kid", label: "สระเด็ก" },
            { key: "grill", label: "เตาปิ้งย่าง" },
          ],
        }}
      />,
    );

    expect(markup).not.toContain("Wi-Fi");
    expect(markup).not.toContain("สระว่ายน้ำส่วนตัว");
    expect(markup).toContain("สระเด็ก");
    expect(markup).toContain("เตาปิ้งย่าง");
  });
  it("reserves the amenity area for multiple visible amenities", () => {
    const markup = renderToStaticMarkup(
      <VillaCard
        villa={{
          ...villa,
          amenities: [
            { key: "private_pool", label: "Pool" },
            { key: "grill", label: "Grill" },
            { key: "karaoke", label: "Karaoke" },
            { key: "pet", label: "Pet" },
          ],
        }}
      />,
    );

    expect(markup).toContain("min-h-[64px]");
  });

  it("reserves the same amenity area for one visible amenity", () => {
    const markup = renderToStaticMarkup(
      <VillaCard
        villa={{
          ...villa,
          amenities: [{ key: "private_pool", label: "Pool" }],
        }}
      />,
    );

    expect(markup).toContain("min-h-[64px]");
  });

  it("reserves the amenity area when amenities are filtered out", () => {
    const markup = renderToStaticMarkup(
      <VillaCard
        villa={{
          ...villa,
          amenities: [{ key: "wifi", label: "Wi-Fi" }],
        }}
      />,
    );

    expect(markup).toContain("min-h-[64px]");
    expect(markup).toContain('aria-hidden="true"');
  });
});
