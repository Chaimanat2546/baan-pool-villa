/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigationMock = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span aria-label={alt} data-src={src} />
  ),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => navigationMock.searchParams,
}));

import type { VillaListing } from "../../../../lib/villas/types";
import { getInitialCatalogComplete, SearchPage } from "../page";

const villa: VillaListing = {
  amenities: [],
  bathrooms: 4,
  bedrooms: 5,
  coverImage: "https://devillegroups.com/imgs/profile_imgs_large/701.jpg",
  distanceToSea: "500m",
  id: "701",
  people: 12,
  poolType: "private",
  price: 15000,
  zone: "jomtien",
  zoneLabel: "Jomtien",
};

describe("SearchPage", () => {
  afterEach(() => {
    navigationMock.searchParams = new URLSearchParams();
    vi.unstubAllGlobals();
  });

  it("renders server-provided villas without waiting for a client fetch", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const markup = renderToStaticMarkup(<SearchPage initialVillas={[villa]} />);

    expect(markup).toContain("701");
    expect(markup).not.toContain("animate-pulse");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("applies server-provided search params during the first render", () => {
    const otherVilla: VillaListing = {
      ...villa,
      id: "702",
      price: 20000,
    };

    const markup = renderToStaticMarkup(
      <SearchPage
        initialSearchParams="id=701"
        initialVillas={[villa, otherVilla]}
      />,
    );

    expect(markup).toContain("701");
    expect(markup).toContain("701");
    expect(markup).not.toContain("702");
  });

  it("applies browser search params when initialSearchParams is omitted", () => {
    navigationMock.searchParams = new URLSearchParams("id=701");
    const otherVilla: VillaListing = {
      ...villa,
      id: "702",
      price: 20000,
    };

    const markup = renderToStaticMarkup(
      <SearchPage initialVillas={[villa, otherVilla]} />,
    );

    expect(markup).toContain("701");
    expect(markup).toContain("701");
    expect(markup).not.toContain("702");
  });

  it("renders partial server results with complete result metadata", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const markup = renderToStaticMarkup(
      <SearchPage
        initialVillas={[villa]}
        initialMeta={{
          catalogComplete: false,
          maxPrice: 20000,
          resultCount: 2,
          zones: [{ value: "jomtien", label: "Jomtien" }],
        }}
      />,
    );

    expect(markup).toContain("พบ 2");
    expect(markup).toContain("ดูเพิ่มเติมอีก");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps search controls visible for zero-result partial catalog URLs", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const markup = renderToStaticMarkup(
      <SearchPage
        initialSearchParams="id=999"
        initialVillas={[]}
        initialMeta={{
          catalogComplete: false,
          maxPrice: 20000,
          resultCount: 0,
          zones: [{ value: "jomtien", label: "Jomtien" }],
        }}
      />,
    );

    expect(markup).toContain('type="search"');
    expect(markup).toContain("พบ 0");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not treat filtered first-page metadata as a complete catalog", () => {
    expect(
      getInitialCatalogComplete({
        catalogComplete: false,
        maxPrice: 20000,
        resultCount: 1,
        zones: [{ value: "jomtien", label: "Jomtien" }],
      }),
    ).toBe(false);
  });

  it("hydrates the full catalog automatically for deep-link query params", async () => {
    const fullCatalog = [
      villa,
      {
        ...villa,
        id: "702",
        price: 20000,
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ items: fullCatalog }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SearchPage
          initialSearchParams="id=702"
          initialVillas={[villa]}
          initialMeta={{
            catalogComplete: false,
            maxPrice: 20000,
            resultCount: 2,
            zones: [{ value: "jomtien", label: "Jomtien" }],
          }}
        />,
      );
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/houses");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
