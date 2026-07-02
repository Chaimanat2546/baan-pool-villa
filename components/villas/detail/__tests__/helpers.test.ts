import { describe, expect, it } from "vitest";
import {
  buildDisplayGallery,
  buildGalleryItems,
  getGalleryItemDescription,
} from "../helpers";
import type { GalleryItem } from "../types";
import type { VillaImage } from "@/lib/villas/types";

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
  it("uses the Supabase cover image first", () => {
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

    const items = buildGalleryItems(images);

    expect(items.map((item) => item.url)).toEqual([
      "https://images.example.com/cover.jpg",
      "https://images.example.com/pool.jpg",
    ]);
  });

  it("treats Supabase images in the รูปปก category as cover images", () => {
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

    const [coverItem] = buildGalleryItems(images);

    expect(coverItem?.url).toBe("https://images.example.com/cover-category.jpg");
    expect(coverItem?.isCover).toBe(true);
    expect(coverItem?.zoneKey).toBe("cover");
    expect(coverItem?.zoneLabel).toBe("รูปปก");
  });

  it("uses the newest cover category image first when cover_select is not set", () => {
    const images: VillaImage[] = [
      {
        caption: null,
        id: 133301,
        imageName: "old-cover.jpg",
        imageUrl:
          "https://s3.ap-southeast-1.amazonaws.com/poolvillas.co.ltd/old-cover.jpg",
        isCover: false,
        zone: "cover",
      },
      {
        caption: null,
        id: 144650,
        imageName: "parking.webp",
        imageUrl:
          "https://webook-media.poolvilla.workers.dev/houses/999/parking.webp",
        isCover: false,
        zone: "parking",
      },
      {
        caption: null,
        id: 144651,
        imageName: "new-cover.webp",
        imageUrl:
          "https://webook-media.poolvilla.workers.dev/houses/999/new-cover.webp",
        isCover: false,
        zone: "cover",
      },
    ];

    const items = buildGalleryItems(images);

    expect(items.map((item) => item.url)).toEqual([
      "https://webook-media.poolvilla.workers.dev/houses/999/new-cover.webp",
      "https://s3.ap-southeast-1.amazonaws.com/poolvillas.co.ltd/old-cover.jpg",
      "https://webook-media.poolvilla.workers.dev/houses/999/parking.webp",
    ]);
    expect(items[2]?.zoneKey).toBe("parking");
  });
});

describe("getGalleryItemDescription", () => {
  it("uses a plain fallback without exposing the image data source", () => {
    expect(getGalleryItemDescription(galleryItem("pool", "pool"))).toBe(
      "รูปบ้านพัก",
    );
  });
});
