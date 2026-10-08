import type { VillaListing } from "@/lib/villas/types";

export type MarketingContactChannel = "line" | "messenger";

type MarketingVillaListing = Pick<
  VillaListing,
  "bedrooms" | "id" | "price" | "title" | "zoneLabel"
>;

interface DataLayerWindow extends Window {
  dataLayer?: Record<string, unknown>[];
}

function getDataLayerWindow(): DataLayerWindow | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window as DataLayerWindow;
}

function getPricePayload(price: number | null) {
  return price === null ? {} : { value: price };
}

export function buildVillaMarketingItem(listing: MarketingVillaListing) {
  const item = {
    item_id: listing.id,
    item_name: listing.title ?? `Pool Villa ${listing.id}`,
    item_category: listing.zoneLabel,
    item_variant: `${listing.bedrooms} bedrooms`,
    quantity: 1,
  };

  return listing.price === null
    ? item
    : {
        ...item,
        price: listing.price,
      };
}

function pushDataLayerEvent(event: Record<string, unknown>) {
  const dataLayerWindow = getDataLayerWindow();

  if (!dataLayerWindow) {
    return;
  }

  dataLayerWindow.dataLayer = dataLayerWindow.dataLayer ?? [];
  dataLayerWindow.dataLayer.push(event);
}

export function pushVillaDetailView(listing: MarketingVillaListing) {
  const pricePayload = getPricePayload(listing.price);

  pushDataLayerEvent({
    event: "view_item",
    currency: "THB",
    ...pricePayload,
    ecommerce: {
      currency: "THB",
      ...pricePayload,
      items: [buildVillaMarketingItem(listing)],
    },
  });
}

export function pushBookingContactClick({
  channel,
  listing,
  location,
}: {
  channel: MarketingContactChannel;
  listing: MarketingVillaListing;
  location: string;
}) {
  const pricePayload = getPricePayload(listing.price);

  pushDataLayerEvent({
    event: "booking_contact_click",
    contact_channel: channel,
    contact_location: location,
    currency: "THB",
    ...pricePayload,
    ecommerce: {
      currency: "THB",
      ...pricePayload,
      items: [buildVillaMarketingItem(listing)],
    },
  });
}
