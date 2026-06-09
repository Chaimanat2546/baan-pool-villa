// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import type { VillaDetailPayload, VillaImage, VillaListing } from "@/lib/villas/types";
import {
  flushEffects,
  makeFetchMock,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { VillaDetailPage } from "../page";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt?: string; src?: string }) => (
    <span data-image-alt={alt} data-image-src={src} />
  ),
}));

vi.mock("../detail-layout-renderer", () => ({
  DetailLayoutRenderer: () => <section data-detail-layout-renderer="true" />,
}));

const listing: VillaListing = {
  id: "129",
  zone: "jomtien",
  zoneLabel: "Jomtien",
  bedrooms: 4,
  bathrooms: 3,
  distanceToSea: "500m",
  price: 12000,
  people: 12,
  coverImage: "https://devillegroups.com/imgs/profile_imgs_large/cover.jpg",
  amenities: [],
  poolType: "private",
};

const listingWithoutCover: VillaListing = {
  ...listing,
  coverImage: null,
};

const payload: VillaDetailPayload = {
  detail: null,
  detailStatus: "missing_token",
  listing,
};

const payloadWithoutCover: VillaDetailPayload = {
  ...payload,
  listing: listingWithoutCover,
};

const deferredImage: VillaImage = {
  id: 7,
  caption: "Pool",
  imageName: "pool.jpg",
  imageUrl: "https://images.example.com/pool.jpg",
  isCover: false,
  zone: "pool",
};

describe("VillaDetailPage", () => {
  it("loads villa gallery image data on the client after the page mounts", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { images: [deferredImage] },
        url: "/api/villas/129/images",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const mounted = await mountAdminPage(
      <VillaDetailPage
        id="129"
        images={[]}
        payload={payload}
        recommendedVillas={[]}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );

    await flushEffects();
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/villas/129/images", {
      method: "GET",
    });
    expect(
      mounted.container.querySelector(
        `[data-image-src="${deferredImage.imageUrl}"]`,
      ),
    ).not.toBeNull();

    await mounted.unmount();
  });

  it("renders deferred gallery images when no listing cover is available", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { images: [deferredImage] },
        url: "/api/villas/129/images",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const mounted = await mountAdminPage(
      <VillaDetailPage
        id="129"
        images={[]}
        payload={payloadWithoutCover}
        recommendedVillas={[]}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );

    await flushEffects();
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledWith("/api/villas/129/images", {
      method: "GET",
    });
    expect(
      mounted.container.querySelector(
        `[data-image-src="${deferredImage.imageUrl}"]`,
      ),
    ).not.toBeNull();

    await mounted.unmount();
  });
});
