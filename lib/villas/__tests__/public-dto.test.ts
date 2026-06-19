import { describe, expect, it } from "vitest";

import { toPublicVillaImages } from "../public-dto";
import type { VillaImage } from "../types";

const image: VillaImage = {
  caption: null,
  id: 7,
  imageName: "pool.jpg",
  imageUrl: "https://images.example.com/pool.jpg",
  isCover: false,
  zone: "pool",
};

describe("public villa DTOs", () => {
  it("filters gallery images that cannot be represented by proxy paths", () => {
    expect(toPublicVillaImages("9", [image, { ...image, id: 0 }])).toEqual([
      {
        ...image,
        imageUrl: "/api/villas/9/images?imageId=7",
      },
    ]);
  });
});
