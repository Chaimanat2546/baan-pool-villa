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
  it("returns same-origin gallery image paths without exposing source URLs", () => {
    expect(
      toPublicVillaImages("9", [
        image,
        {
          ...image,
          id: 0,
          imageUrl: "https://images.example.com/uploaded-cover.jpg",
          isCover: true,
          zone: "cover",
        },
        { ...image, imageUrl: "http://x.test/pool.jpg" },
      ]),
    ).toEqual([
      {
        ...image,
        imageUrl: "/api/villas/9/images?imageId=7",
      },
      {
        ...image,
        id: 0,
        imageUrl: "/api/houses/images/9",
        isCover: true,
        zone: "cover",
      },
    ]);
  });

  it("returns a same-origin house image path for listing covers", () => {
    const villa: VillaListing = {
      amenities: [],
      bathrooms: 4,
      bedrooms: 5,
      coverImage: "https://images.example.com/cover.jpg",
      distanceToSea: "-",
      id: "9",
      people: 12,
      poolType: "salt",
      price: 0,
      zone: "pattaya",
      zoneLabel: "pattaya",
    };

    expect(toPublicVillaListing(villa).coverImage).toBe(
      "/api/houses/images/9",
    );
    expect(toPublicVillaListing(toPublicVillaListing(villa)).coverImage).toBe(
      "/api/houses/images/9",
    );
  });

  it("removes source URLs from legacy same-origin listing cover routes", () => {
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
      "/api/houses/images/9",
    );
  });
});
