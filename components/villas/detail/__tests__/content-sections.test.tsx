import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { VillaListing } from "@/lib/villas/types";
import {
  AboutSection,
  AmenitiesSection,
} from "../content-sections";
import { NearbySection } from "../nearby-section";

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
  amenities: [],
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

const contentWithNearbyPlaces: VillaDetailContent = {
  ...content,
  nearbyPlaces: [
    {
      name: "The Glass House Beachfront Restaurant and Bar",
      zone: "บางเสร่",
      url: "https://maps.app.goo.gl/example-one",
    },
    {
      name: "Cave Beach Club",
      zone: "บางเสร่",
      url: "https://maps.app.goo.gl/example-two",
    },
  ],
};

describe("Detail content sections", () => {
  it("AboutSection renders without mock badges", () => {
    const markup = renderToStaticMarkup(
      <AboutSection content={content} listing={listing} />,
    );

    expect(markup).not.toContain("Mock FE");
  });

  it("lays nearby cards into a bounded tablet grid", () => {
    const markup = renderToStaticMarkup(
      <NearbySection content={contentWithNearbyPlaces} />,
    );

    expect(markup).toContain("md:grid-cols-2");
    expect(markup).toContain("md:overflow-visible");
    expect(markup).toContain("md:w-full");
    expect(markup).toContain("md:hidden");
    expect(markup).not.toContain("lg:hidden");
  });

  it("uses stable icons for each amenity key instead of list position", () => {
    const markup = renderToStaticMarkup(
      <AmenitiesSection
        amenities={[
          { key: "wifi", label: "Wi-Fi" },
          { key: "grill", label: "เตาปิ้งย่าง" },
          { key: "tabletennis", label: "โต๊ะปิงปอง" },
          { key: "karaoke", label: "คาราโอเกะ" },
          { key: "pet", label: "นำสัตว์เลี้ยงได้" },
        ]}
      />,
    );

    expect(markup).toContain('data-amenity-icon="wifi"');
    expect(markup).toContain("lucide-wifi");
    expect(markup).toContain('data-amenity-icon="grill"');
    expect(markup).toContain("lucide-flame");
    expect(markup).toContain('data-amenity-icon="karaoke"');
    expect(markup).toContain("lucide-music");
    expect(markup).toContain('data-amenity-icon="pet"');
    expect(markup).toContain("lucide-paw-print");
  });
});
