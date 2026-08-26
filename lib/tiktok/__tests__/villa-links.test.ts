import { describe, expect, it } from "vitest";

import type { VillaListing } from "@/lib/villas/types";
import {
  resolveTikTokVillaLinks,
  searchTikTokVillaOptions,
  TIKTOK_VILLA_SEARCH_LIMIT,
} from "../villa-links";

function villa(id: string, title?: string): VillaListing {
  return {
    amenities: [],
    bathrooms: 2,
    bedrooms: 3,
    coverImage: null,
    distanceToSea: "500m",
    id,
    people: 8,
    poolType: "private",
    price: 5000,
    title,
    zone: "jomtien",
    zoneLabel: "Jomtien",
  };
}

describe("TikTok villa links", () => {
  it("finds villas by trimmed ID or case-insensitive title fragments", () => {
    const villas = [
      villa("501", "Glass House B8"),
      villa("502", "Villa Port Sand"),
    ];

    expect(searchTikTokVillaOptions(villas, " 501 ")).toEqual([
      { id: "501", title: "Glass House B8" },
    ]);
    expect(searchTikTokVillaOptions(villas, "PORT")).toEqual([
      { id: "502", title: "Villa Port Sand" },
    ]);
  });

  it("returns no choices for a blank query and bounds broad results", () => {
    const villas = Array.from({ length: TIKTOK_VILLA_SEARCH_LIMIT + 2 }, (_, index) =>
      villa(String(index + 1), `Villa ${index + 1}`),
    );

    expect(searchTikTokVillaOptions(villas, "   ")).toEqual([]);
    expect(searchTikTokVillaOptions(villas, "villa")).toHaveLength(
      TIKTOK_VILLA_SEARCH_LIMIT,
    );
  });

  it("uses current catalog titles and omits links for missing saved IDs", () => {
    const videos = [
      {
        houseId: "501",
        url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
        videoId: "7370000000000000001",
      },
      {
        houseId: "999",
        url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000002",
        videoId: "7370000000000000002",
      },
    ];

    expect(resolveTikTokVillaLinks(videos, [villa("501", "Renamed Glass House")])).toEqual([
      {
        ...videos[0],
        villa: { id: "501", title: "Renamed Glass House" },
      },
      {
        ...videos[1],
        villa: null,
      },
    ]);
  });
});
