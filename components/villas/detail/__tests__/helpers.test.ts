import { describe, expect, it } from "vitest";
import {
  buildDisplayGallery,
  buildGalleryItems,
  getGalleryItemDescription,
} from "../helpers";
import type { GalleryItem } from "../types";
import type { VillaDetailPayload, VillaImage } from "@/lib/villas/types";

function galleryItem(key: string, zoneKey: string): GalleryItem {
  return {
    key,
    url: `https://example.com/${key}.jpg`,
    caption: null,
    imageName: `${key}.jpg`,
    isCover: zoneKey === "cover",
    isMock: false,
    zone: zoneKey,
    zoneLabel: zoneKey,
    zoneKey,
  };
}

describe("buildDisplayGallery", () => {
  it("keeps the cover first and prioritizes outside, inside, then review in bento slots", () => {
    const displayItems = buildDisplayGallery([
      galleryItem("cover", "cover"),
      galleryItem("bedroom", "bedroom"),
      galleryItem("review", "review"),
      galleryItem("inside", "inside"),
      galleryItem("outside", "outside"),
      galleryItem("pool", "pool"),
    ]);

    expect(displayItems.map((item) => item.key)).toEqual([
      "cover",
      "outside",
      "inside",
      "review",
    ]);
  });

  it("does not duplicate or fallback when fewer side images are available", () => {
    const displayItems = buildDisplayGallery([
      galleryItem("cover", "cover"),
      galleryItem("pool", "pool"),
    ]);

    expect(displayItems.map((item) => item.key)).toEqual(["cover", "pool"]);
  });
});

describe("buildGalleryItems", () => {
  it("uses the Supabase cover image first without adding the listing API cover", () => {
    const payload = {
      detail: null,
      detailStatus: "missing_token",
      listing: {
        amenities: [],
        bathrooms: 3,
        bedrooms: 4,
        coverImage: "https://devillegroups.com/imgs/profile_imgs_large/9.jpg",
        distanceToSea: null,
        id: "9",
        people: 10,
        poolType: null,
        price: 9000,
        zone: null,
        zoneLabel: null,
      },
    } satisfies VillaDetailPayload;
    const images: VillaImage[] = [
      {
        caption: "Pool",
        id: 2,
        imageName: "pool.jpg",
        imageUrl: "https://images.example.com/pool.jpg",
        isCover: false,
        zone: "outside",
      },
      {
        caption: "Cover",
        id: 3,
        imageName: "cover.jpg",
        imageUrl: "https://images.example.com/cover.jpg",
        isCover: true,
        zone: "cover",
      },
    ];

    const items = buildGalleryItems(payload, images);

    expect(items.map((item) => item.url)).toEqual([
      "https://images.example.com/cover.jpg",
      "https://images.example.com/pool.jpg",
    ]);
    expect(items.map((item) => item.url)).not.toContain(
      "https://devillegroups.com/imgs/profile_imgs_large/9.jpg",
    );
  });

  it("treats Supabase images in the รูปปก category as cover images", () => {
    const payload = {
      detail: null,
      detailStatus: "missing_token",
      listing: {
        amenities: [],
        bathrooms: 3,
        bedrooms: 4,
        coverImage: null,
        distanceToSea: null,
        id: "9",
        people: 10,
        poolType: null,
        price: 9000,
        zone: null,
        zoneLabel: null,
      },
    } satisfies VillaDetailPayload;
    const images: VillaImage[] = [
      {
        caption: "Pool",
        id: 2,
        imageName: "pool.jpg",
        imageUrl: "https://images.example.com/pool.jpg",
        isCover: false,
        zone: "pool",
      },
      {
        caption: "Cover category",
        id: 3,
        imageName: "cover-category.jpg",
        imageUrl: "https://images.example.com/cover-category.jpg",
        isCover: false,
        zone: "รูปปก",
      },
    ];

    const [coverItem] = buildGalleryItems(payload, images);

    expect(coverItem?.url).toBe("https://images.example.com/cover-category.jpg");
    expect(coverItem?.isCover).toBe(true);
    expect(coverItem?.zoneKey).toBe("cover");
    expect(coverItem?.zoneLabel).toBe("รูปปก");
  });
});

describe("getGalleryItemDescription", () => {
  it("uses a plain fallback without exposing the image data source", () => {
    expect(getGalleryItemDescription(galleryItem("pool", "pool"))).toBe(
      "รูปบ้านพัก",
    );
  });
});
