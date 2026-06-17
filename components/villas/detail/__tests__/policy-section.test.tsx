import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { VillaListing } from "@/lib/villas/types";
import { PolicySection } from "../policy-section";

const listing: VillaListing = {
  amenities: [{ key: "pet", label: "นำสัตว์เลี้ยงได้" }],
  bathrooms: 3,
  bedrooms: 4,
  coverImage: null,
  distanceToSea: "500m",
  id: "66",
  people: 12,
  poolType: "private",
  price: 12000,
  zone: "jomtien",
  zoneLabel: "Jomtien",
};

const content: VillaDetailContent = {
  amenities: [],
  facts: [
    { label: "เช็คอิน", value: "14:00" },
    { label: "เช็คเอาต์", value: "12:00" },
    { label: "พักได้สูงสุด", value: "16 คน" },
  ],
  location: {
    address: "Jomtien Beach",
    mapUrl: null,
    seaDistance: "500m",
  },
  nearbyPlaces: [],
  sections: [],
  videos: [],
};

describe("PolicySection", () => {
  it("renders stable policy cards from villa content", () => {
    const markup = renderToStaticMarkup(
      <PolicySection content={content} listing={listing} />,
    );

    expect(markup).toContain("นโยบายที่พัก");
    expect(markup).toContain("14:00");
    expect(markup).toContain("16 คน");
    expect(markup).toContain("อนุญาตให้นำสัตว์เลี้ยงเข้าพักได้");
    expect(markup).not.toContain("Mock FE");
  });
});
