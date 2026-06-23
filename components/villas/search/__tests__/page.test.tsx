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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function createCatalogResponse(
  items: VillaListing[],
  overrides: Partial<{
    hasMore: boolean;
    page: number;
    pageSize: number;
    total: number;
  }> = {},
) {
  return {
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({
      hasMore: overrides.hasMore ?? false,
      items,
      page: overrides.page ?? 1,
      pageSize: overrides.pageSize ?? 12,
      total: overrides.total ?? items.length,
    }),
    ok: true,
  } as Response;
}

function expectCatalogFetchCall(
  fetchMock: ReturnType<typeof vi.fn>,
  callNumber: number,
  url: string,
) {
  expect(fetchMock).toHaveBeenNthCalledWith(callNumber, url, {
    signal: expect.any(AbortSignal),
  });
}

describe("SearchPage", () => {
  afterEach(() => {
    navigationMock.searchParams = new URLSearchParams();
    window.sessionStorage.clear();
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

  it("deduplicates appended catalog pages by villa id", async () => {
    const nextVilla = {
      ...villa,
      id: "702",
      price: 20000,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      createCatalogResponse([villa, nextVilla], {
        hasMore: false,
        page: 2,
        total: 2,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
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
    });

    const loadMoreButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("ดูเพิ่มเติม"),
    );

    await act(async () => {
      loadMoreButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.querySelectorAll('a[href="/villas/701"]')).toHaveLength(1);
    expect(container.querySelectorAll('a[href="/villas/702"]')).toHaveLength(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("loads one additional bounded catalog page at a time", async () => {
    const nextVilla = {
      ...villa,
      id: "702",
      price: 20000,
    };
    const appendRequest = createDeferred<Response>();
    const fetchMock = vi.fn().mockReturnValue(appendRequest.promise);
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
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
    });

    const loadMoreButton = Array.from(container.querySelectorAll("button")).find(
      (button) =>
        button.textContent?.includes("ดูเพิ่มเติม") ||
        button.textContent?.includes("à¸”à¸¹à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸•à¸´à¸¡"),
    );

    await act(async () => {
      loadMoreButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      loadMoreButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expectCatalogFetchCall(
      fetchMock,
      1,
      "/api/houses?guests=1&bedrooms=1&maxPrice=20000&sort=recommended&page=2&limit=12",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(loadMoreButton).toHaveProperty("disabled", true);
    expect(container.querySelector('[data-villa-grid-skeleton="true"]')).not.toBeNull();

    await act(async () => {
      appendRequest.resolve(
        createCatalogResponse([nextVilla], {
          hasMore: false,
          page: 2,
          total: 2,
        }),
      );
      await Promise.resolve();
    });

    expect(container.querySelectorAll('a[href="/villas/702"]')).toHaveLength(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("restores appended catalog pages from session storage on remount", async () => {
    const nextVilla = {
      ...villa,
      id: "702",
      price: 20000,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      createCatalogResponse([nextVilla], {
        hasMore: false,
        page: 2,
        total: 2,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
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
    });

    const loadMoreButton = Array.from(container.querySelectorAll("button")).at(-1);

    await act(async () => {
      loadMoreButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(Array.from({ length: window.sessionStorage.length }, (_, index) =>
      window.sessionStorage.key(index),
    )).toEqual([expect.stringContaining("bpv:search-page:")]);
    expect(window.sessionStorage.getItem(window.sessionStorage.key(0) ?? "")).toContain(
      '"loadedCatalogPage":2',
    );

    await act(async () => {
      root.unmount();
    });

    const nextRoot = createRoot(container);

    await act(async () => {
      nextRoot.render(
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
      await Promise.resolve();
    });

    expect(container.querySelectorAll('a[href="/villas/701"]')).toHaveLength(1);
    expect(container.querySelectorAll('a[href="/villas/702"]')).toHaveLength(1);

    await act(async () => {
      nextRoot.unmount();
    });
    container.remove();
  });

  it("does not restore a saved catalog page for a different query", async () => {
    const nextVilla = {
      ...villa,
      id: "702",
      price: 20000,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      createCatalogResponse([nextVilla], {
        hasMore: false,
        page: 2,
        total: 2,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
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
    });

    const loadMoreButton = Array.from(container.querySelectorAll("button")).at(-1);

    await act(async () => {
      loadMoreButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      root.unmount();
    });

    const nextRoot = createRoot(container);

    await act(async () => {
      nextRoot.render(
        <SearchPage
          initialSearchParams="id=999"
          initialVillas={[villa]}
          initialMeta={{
            catalogComplete: false,
            maxPrice: 20000,
            resultCount: 0,
            zones: [{ value: "jomtien", label: "Jomtien" }],
          }}
        />,
      );
      await Promise.resolve();
    });

    expect(container.querySelectorAll('a[href="/villas/702"]')).toHaveLength(0);

    await act(async () => {
      nextRoot.unmount();
    });
    container.remove();
  });

  it("waits for the search button before loading a bounded search page", async () => {
    const matchingVilla = {
      ...villa,
      id: "702",
      price: 20000,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      createCatalogResponse([matchingVilla]),
    );
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

    expectCatalogFetchCall(
      fetchMock,
      1,
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
    const fetchMock = vi.fn().mockResolvedValue(
      createCatalogResponse([matchingVilla]),
    );
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

    expectCatalogFetchCall(
      fetchMock,
      1,
      "/api/houses?guests=1&bedrooms=1&maxPrice=20000&id=702&sort=recommended&page=1&limit=12",
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("persists the submitted sort order in the URL for refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createCatalogResponse([villa]));
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", "/search");

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SearchPage
          initialVillas={[villa]}
          initialMeta={{
            catalogComplete: false,
            maxPrice: 20000,
            resultCount: 1,
            zones: [{ value: "jomtien", label: "Jomtien" }],
          }}
        />,
      );
    });

    const sortButton = container.querySelector<HTMLButtonElement>(
      'button[aria-haspopup="listbox"]',
    );

    expect(sortButton).not.toBeNull();

    await act(async () => {
      sortButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const priceDescOption = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="option"]'),
    )[2];

    expect(priceDescOption).not.toBeUndefined();

    await act(async () => {
      priceDescOption?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const searchButton = findSearchSubmitButton(container);

    await act(async () => {
      searchButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(window.location.search).toContain("sort=price_desc");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps the newest submitted search when catalog requests finish out of order", async () => {
    const staleVilla = {
      ...villa,
      id: "702",
      price: 20000,
    };
    const newestVilla = {
      ...villa,
      id: "703",
      price: 21000,
    };
    const firstRequest = createDeferred<Response>();
    const secondRequest = createDeferred<Response>();
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) => {
        if (init?.signal) {
          signals.push(init.signal);
        }

        return signals.length === 1
          ? firstRequest.promise
          : secondRequest.promise;
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SearchPage
          initialVillas={[villa]}
          initialMeta={{
            catalogComplete: false,
            maxPrice: 22000,
            resultCount: 3,
            zones: [{ value: "jomtien", label: "Jomtien" }],
          }}
        />,
      );
    });

    const searchInput = container.querySelector<HTMLInputElement>(
      'input[type="search"]',
    );
    const searchButton = findSearchSubmitButton(container);

    expect(searchInput).not.toBeNull();
    expect(searchButton).not.toBeUndefined();

    await act(async () => {
      setSearchInputValue(searchInput as HTMLInputElement, "702");
      searchButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-search-pool-ripple="true"]')).not.toBeNull();
    expectCatalogFetchCall(
      fetchMock,
      1,
      "/api/houses?guests=1&bedrooms=1&maxPrice=22000&id=702&sort=recommended&page=1&limit=12",
    );
    expect(signals[0]?.aborted).toBe(false);

    await act(async () => {
      setSearchInputValue(searchInput as HTMLInputElement, "703");
      searchButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expectCatalogFetchCall(
      fetchMock,
      2,
      "/api/houses?guests=1&bedrooms=1&maxPrice=22000&id=703&sort=recommended&page=1&limit=12",
    );
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    await act(async () => {
      secondRequest.resolve(createCatalogResponse([newestVilla]));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("703");
    expect(container.textContent).not.toContain("702");

    await act(async () => {
      firstRequest.resolve(createCatalogResponse([staleVilla]));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("703");
    expect(container.textContent).not.toContain("702");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("does not parse catalog responses that are not JSON", async () => {
    const jsonMock = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      headers: new Headers({ "content-type": "text/html" }),
      json: jsonMock,
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
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
    });

    const searchButton = findSearchSubmitButton(container);

    await act(async () => {
      searchButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(jsonMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("โหลดข้อมูลไม่สำเร็จ");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
