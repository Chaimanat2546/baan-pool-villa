import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import type { VillaDetailContent } from "@/lib/villas/detail";
import type { VillaListing } from "@/lib/villas/types";
import { BookingSidebar } from "../booking-sidebar";

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
  location: null,
  nearbyPlaces: [],
  sections: [],
  videos: [],
};

describe("BookingSidebar", () => {
  it("hides prototype-like calendar mock UI and keeps contact actions", () => {
    const markup = renderToStaticMarkup(
      <BookingSidebar
        content={content}
        listing={listing}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );

    expect(markup).not.toContain("October 2024");
    expect(markup).not.toContain("Mock FE");
    expect(markup).toContain("แชทเลย");
    expect(markup).toContain("จองผ่าน LINE");
  });
});
