/**
 * @vitest-environment jsdom
 */
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import type {
  VillaDetailPayload,
  VillaImage,
  VillaListing,
} from "@/lib/villas/types";
import type { GalleryItem } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("../gallery", () => ({
  Gallery: ({
    items,
    onImageClick,
    totalImageCount,
  }: {
    items: GalleryItem[];
    onImageClick: (item: GalleryItem) => void;
    totalImageCount: number;
  }) => (
    <section
      data-gallery-items={items.map((item) => item.url).join("|")}
      data-gallery-total={totalImageCount}
    >
      {items.map((item) => (
        <button
          data-gallery-item={item.url}
          key={item.key}
          type="button"
          onClick={() => {
            onImageClick(item);
          }}
        >
          {item.zoneLabel}
        </button>
      ))}
    </section>
  ),
  GalleryLightbox: ({ activeItem }: { activeItem: GalleryItem | null }) =>
    activeItem ? <div data-lightbox-active={activeItem.url} /> : null,
}));

vi.mock("../detail-layout-renderer", () => ({
  DetailLayoutRenderer: ({
    galleryCategories,
  }: {
    galleryCategories: Array<{ items: GalleryItem[] }>;
  }) => (
    <div
      data-detail-gallery-urls={galleryCategories
        .flatMap((category) => category.items.map((item) => item.url))
        .join("|")}
    />
  ),
}));

import { VillaDetailPage } from "../page";

const listing: VillaListing = {
  amenities: [],
  bathrooms: 5,
  bedrooms: 4,
  coverImage: "https://images.example.com/cover-9.jpg",
  distanceToSea: "500m",
  id: "9",
  people: 12,
  poolType: "private",
  price: 12000,
  zone: "pattaya",
  zoneLabel: "Pattaya",
};

const apiImage: VillaImage = {
  caption: "Pool",
  id: 2,
  imageName: "pool.jpg",
  imageUrl: "https://images.example.com/pool.jpg",
  isCover: false,
  zone: "outside",
};

function makePayload(activeListing = listing): VillaDetailPayload {
  return {
    detail: null,
    detailStatus: "missing_token",
    listing: activeListing,
  };
}

function renderPage() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  return {
    container,
    async render(nextElement: ReactElement) {
      await act(async () => {
        root.render(nextElement);
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

function makePage(id = listing.id, activeListing = listing) {
  return (
    <VillaDetailPage
      id={id}
      payload={makePayload(activeListing)}
      recommendedVillas={[]}
      settings={DEFAULT_SITE_SETTINGS}
    />
  );
}

function makeJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

async function clickFirstGalleryItem(container: HTMLElement) {
  const galleryButton = container.querySelector(
    "[data-gallery-item]",
  ) as HTMLButtonElement | null;

  if (!galleryButton) {
    throw new Error(
      'clickFirstGalleryItem expected a "[data-gallery-item]" button to be present.',
    );
  }

  await act(async () => {
    galleryButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flushReact();
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("VillaDetailPage deferred gallery loader", () => {
  it("requests gallery images on mount so the visible gallery fills in", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse({ images: [apiImage] }));
    vi.stubGlobal("fetch", fetchMock);
    const page = renderPage();

    await page.render(makePage());
    await flushReact();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(page.container.querySelector("[data-gallery-item]")).not.toBeNull();
    expect(
      page.container.querySelector("[data-detail-gallery-urls]")?.getAttribute(
        "data-detail-gallery-urls",
      ),
    ).toContain(apiImage.imageUrl);

    await page.unmount();
  });

  it("retries gallery loading after a transient API failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ error: "temporary" }, 502))
      .mockResolvedValueOnce(makeJsonResponse({ images: [apiImage] }));
    vi.stubGlobal("fetch", fetchMock);
    const page = renderPage();

    await page.render(makePage());
    await flushReact();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(page.container.querySelector("[data-gallery-load-status]")?.textContent).toContain(
      "ลองใหม่",
    );

    const retryButton = page.container.querySelector(
      "[data-gallery-retry]",
    ) as HTMLButtonElement | null;
    expect(retryButton).not.toBeNull();

    await act(async () => {
      retryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReact();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      page.container.querySelector("[data-detail-gallery-urls]")?.getAttribute(
        "data-detail-gallery-urls",
      ),
    ).toContain(apiImage.imageUrl);

    await page.unmount();
  });

  it("shows a skeleton in the gallery area while gallery images are loading after interaction", async () => {
    const pendingResponse = deferred<Response>();
    const fetchMock = vi.fn(() => pendingResponse.promise);
    vi.stubGlobal("fetch", fetchMock);
    const page = renderPage();

    await page.render(makePage());
    await flushReact();

    expect(page.container.querySelector('[data-gallery-skeleton="true"]')).not.toBeNull();
    expect(page.container.querySelector("[data-gallery-item]")).toBeNull();
    expect(page.container.querySelector('[data-gallery-load-status="loading"]')).toBeNull();

    pendingResponse.resolve(makeJsonResponse({ images: [apiImage] }));
    await flushReact();
    await page.unmount();
  });

  it("reuses loaded gallery images instead of issuing another request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse({ images: [apiImage] }));
    vi.stubGlobal("fetch", fetchMock);
    const page = renderPage();

    await page.render(makePage());
    await flushReact();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await clickFirstGalleryItem(page.container);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(page.container.querySelector("[data-lightbox-active]")).not.toBeNull();

    await clickFirstGalleryItem(page.container);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await page.unmount();
  });

  it("clears the active lightbox selection when the villa id changes", async () => {
    const villaTen: VillaListing = {
      ...listing,
      coverImage: "https://images.example.com/cover-10.jpg",
      id: "10",
    };
    const imageForTen = {
      ...apiImage,
      id: 10,
      imageUrl: "https://images.example.com/villa-10-pool.jpg",
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/villas/10/images")) {
        return Promise.resolve(makeJsonResponse({ images: [imageForTen] }));
      }

      return Promise.resolve(makeJsonResponse({ images: [apiImage] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const page = renderPage();

    await page.render(makePage("9", listing));
    await flushReact();

    await clickFirstGalleryItem(page.container);

    expect(page.container.querySelector("[data-lightbox-active]")).not.toBeNull();

    await page.render(makePage("10", villaTen));
    await flushReact();

    expect(page.container.querySelector("[data-lightbox-active]")).toBeNull();

    await page.unmount();
  });

  it("does not let an old villa image request overwrite a newer villa id", async () => {
    const villaTen: VillaListing = {
      ...listing,
      coverImage: "https://images.example.com/cover-10.jpg",
      id: "10",
    };
    const imageForNine = {
      ...apiImage,
      id: 9,
      imageUrl: "https://images.example.com/villa-9-pool.jpg",
    };
    const imageForTen = {
      ...apiImage,
      id: 10,
      imageUrl: "https://images.example.com/villa-10-pool.jpg",
    };
    const pendingNine = deferred<Response>();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/villas/9/images")) {
        return pendingNine.promise;
      }

      if (url.includes("/api/villas/10/images")) {
        return Promise.resolve(makeJsonResponse({ images: [imageForTen] }));
      }

      return Promise.resolve(makeJsonResponse({ images: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const page = renderPage();

    await page.render(makePage("9", listing));
    await flushReact();

    await page.render(makePage("10", villaTen));
    await flushReact();
    await clickFirstGalleryItem(page.container);

    pendingNine.resolve(makeJsonResponse({ images: [imageForNine] }));
    await flushReact();

    const galleryUrls =
      page.container
        .querySelector("[data-detail-gallery-urls]")
        ?.getAttribute("data-detail-gallery-urls") ?? "";

    expect(galleryUrls).toContain(imageForTen.imageUrl);
    expect(galleryUrls).not.toContain(imageForNine.imageUrl);

    await page.unmount();
  });
});
