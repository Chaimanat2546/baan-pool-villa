import { describe, expect, it } from "vitest";
import { buildDisplayGallery } from "../helpers";
import type { GalleryItem } from "../types";

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
