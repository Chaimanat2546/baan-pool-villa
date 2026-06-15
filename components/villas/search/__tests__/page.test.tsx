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

function setSearchInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function findSearchSubmitButton(container: HTMLElement) {
  return Array.from(container.querySelectorAll("button")).find((button) => {
    const buttonText = button.textContent ?? "";

    return buttonText.includes("ค้นหาบ้านพัก");
  });
}

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

  it("waits for the search button before loading a bounded search page", async () => {
    const matchingVilla = {
      ...villa,
      id: "702",
      price: 20000,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        hasMore: false,
        items: [matchingVilla],
        page: 1,
        pageSize: 12,
        total: 1,
      }),
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

    expect(fetchMock).not.toHaveBeenCalled();

    const searchButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("ค้นหาบ้านพัก"),
    );

    expect(searchButton).not.toBeUndefined();

    await act(async () => {
      searchButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/houses?guests=1&bedrooms=1&maxPrice=20000&id=702&sort=recommended&page=1&limit=12",
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps edited filter values as drafts until search is submitted", async () => {
    const matchingVilla = {
      ...villa,
      id: "702",
      price: 20000,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        hasMore: false,
        items: [matchingVilla],
        page: 1,
        pageSize: 12,
        total: 1,
      }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SearchPage
          initialVillas={[villa, matchingVilla]}
          initialMeta={{
            catalogComplete: false,
            maxPrice: 20000,
            resultCount: 2,
            zones: [{ value: "jomtien", label: "Jomtien" }],
          }}
        />,
      );
    });

    const searchInput = container.querySelector<HTMLInputElement>(
      'input[type="search"]',
    );

    expect(searchInput).not.toBeNull();
    expect(container.textContent).toContain("701");
    expect(container.textContent).toContain("702");

    await act(async () => {
      setSearchInputValue(searchInput as HTMLInputElement, "702");
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("701");
    expect(container.textContent).toContain("702");

    const searchButton = findSearchSubmitButton(container);

    expect(searchButton).not.toBeUndefined();

    await act(async () => {
      searchButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/houses?guests=1&bedrooms=1&maxPrice=20000&id=702&sort=recommended&page=1&limit=12",
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
