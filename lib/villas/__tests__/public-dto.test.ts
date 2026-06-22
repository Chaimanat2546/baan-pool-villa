import { describe, expect, it } from "vitest";

import { toPublicVillaImages, toPublicVillaListing } from "../public-dto";
import type { VillaImage, VillaListing } from "../types";

const image: VillaImage = {
  caption: null,
  id: 7,
  imageName: "pool.jpg",
  imageUrl: "https://images.example.com/pool.jpg",
  isCover: false,
  zone: "pool",
};

describe("public villa DTOs", () => {
  it("returns normalized gallery image source URLs for AWS loader rendering", () => {
    expect(toPublicVillaImages("9", [image, { ...image, imageUrl: "http://x.test/pool.jpg" }])).toEqual([
      {
        ...image,
        imageUrl: "https://images.example.com/pool.jpg",
      },
    ]);
  });

  it("keeps same-origin villa image routes for listing covers", () => {
    const villa: VillaListing = {
      amenities: [],
      bathrooms: 4,
      bedrooms: 5,
      coverImage: "/api/villas/9/images?imageId=4&w=640",
      distanceToSea: "-",
      id: "9",
      people: 12,
      poolType: "salt",
      price: 0,
      zone: "pattaya",
      zoneLabel: "pattaya",
    };

    expect(toPublicVillaListing(villa).coverImage).toBe(
      "/api/villas/9/images?imageId=4",
    );
  });

  it("keeps same-origin villa image routes that point at a Supabase source URL", () => {
    const villa: VillaListing = {
      amenities: [],
      bathrooms: 4,
      bedrooms: 5,
      coverImage:
        "/api/villas/9/images?url=https%3A%2F%2Fexample.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fvillas%2Fcover.jpg&w=640",
      distanceToSea: "-",
      id: "9",
      people: 12,
      poolType: "salt",
      price: 0,
      zone: "pattaya",
      zoneLabel: "pattaya",
    };

    expect(toPublicVillaListing(villa).coverImage).toBe(
      "/api/villas/9/images?url=https%3A%2F%2Fexample.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fvillas%2Fcover.jpg",
    );
  });
});
