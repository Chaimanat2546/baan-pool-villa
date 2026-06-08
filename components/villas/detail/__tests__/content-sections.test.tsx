import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { VillaListing } from "@/lib/villas/types";
import {
  AboutSection,
  PolicySection,
} from "../content-sections";

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

const content: VillaDetailContent = {
  facts: [
    { label: "เวลาเช็คอิน", value: "14:00" },
    { label: "เวลาเช็คเอาต์", value: "12:00" },
  ],
  location: {
    address: "Jomtien Beach",
    seaDistance: "500m",
    mapUrl: null,
  },
  sections: [],
  nearbyPlaces: [],
  videos: [],
};

describe("Detail content sections", () => {
  it("AboutSection renders without mock badges", () => {
    const markup = renderToStaticMarkup(
      <AboutSection content={content} listing={listing} />,
    );

    expect(markup).not.toContain("Mock FE");
  });

  it("PolicySection does not expose mock prototype copy", () => {
    const markup = renderToStaticMarkup(
      <PolicySection content={content} listing={listing} />,
    );

    expect(markup).not.toContain("Mock FE");
  });
});
