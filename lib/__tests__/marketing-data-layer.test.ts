// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import type { VillaListing } from "@/lib/villas/types";
import {
  buildVillaMarketingItem,
  pushBookingContactClick,
  pushVillaDetailView,
} from "../marketing-data-layer";

const listing: VillaListing = {
  id: "66",
  title: "BPV 66",
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

describe("marketing data layer", () => {
  beforeEach(() => {
    delete (window as typeof window & { dataLayer?: unknown[] }).dataLayer;
  });

  it("builds a Google Ads compatible villa item payload", () => {
    expect(buildVillaMarketingItem(listing)).toEqual({
      item_id: "66",
      item_name: "BPV 66",
      item_category: "Jomtien",
      item_variant: "4 bedrooms",
      price: 12000,
      quantity: 1,
    });
  });

  it("pushes a view_item event without replacing an existing dataLayer", () => {
    const existingEvent = { event: "existing" };
    (window as typeof window & { dataLayer?: unknown[] }).dataLayer = [existingEvent];

    pushVillaDetailView(listing);

    expect((window as typeof window & { dataLayer?: unknown[] }).dataLayer).toEqual([
      existingEvent,
      {
        event: "view_item",
        currency: "THB",
        value: 12000,
        ecommerce: {
          currency: "THB",
          value: 12000,
          items: [buildVillaMarketingItem(listing)],
        },
      },
    ]);
  });

  it("pushes booking contact clicks with channel and villa item data", () => {
    pushBookingContactClick({
      channel: "line",
      listing,
      location: "booking_sidebar",
    });

    expect((window as typeof window & { dataLayer?: unknown[] }).dataLayer).toEqual([
      {
        event: "booking_contact_click",
        contact_channel: "line",
        contact_location: "booking_sidebar",
        currency: "THB",
        value: 12000,
        ecommerce: {
          currency: "THB",
          value: 12000,
          items: [buildVillaMarketingItem(listing)],
        },
      },
    ]);
  });
});
