/**
 * @vitest-environment jsdom
 */
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SITE_CONTACT_SETTINGS } from "@/lib/site-contact-settings/defaults";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import { DEFAULT_SITE_WEB_STYLES } from "@/lib/site-web-styles/defaults";
import type { BookingCalendarMonth } from "@/lib/villas/booking-calendar";
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
    onViewAll,
    totalImageCount,
  }: {
    items: GalleryItem[];
    onImageClick: (item: GalleryItem) => void;
    onViewAll: () => void;
    totalImageCount: number | null;
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
      <button data-gallery-view-all type="button" onClick={onViewAll}>
        view all
      </button>
    </section>
  ),
  GalleryLightbox: ({
    activeItem,
    onClose,
    showCategorySelector,
    thumbnailPlacement,
  }: {
    activeItem: GalleryItem | null;
    onClose: () => void;
    showCategorySelector?: boolean;
    thumbnailPlacement?: "bottom" | "side";
  }) =>
    activeItem ? (
      <div
        data-lightbox-active={activeItem.url}
        data-lightbox-category-selector={String(showCategorySelector)}
        data-lightbox-thumbnail-placement={thumbnailPlacement}
      >
        <button data-lightbox-close type="button" onClick={onClose}>
          close
        </button>
      </div>
    ) : null,
}));

vi.mock("../gallery-overview-modal", () => ({
  GalleryOverviewModal: ({
    categories,
    onClose,
    onSelect,
  }: {
    categories: Array<{ items: GalleryItem[] }>;
    onClose: () => void;
    onSelect: (item: GalleryItem) => void;
  }) => (
    <div data-gallery-overview="true">
      <button data-overview-close type="button" onClick={onClose}>
        close overview
      </button>
      <button
        data-overview-item
        type="button"
        onClick={() => onSelect(categories[0].items[0])}
      >
        open item
      </button>
    </div>
  ),
}));

vi.mock("../detail-layout-renderer", () => ({
  DetailLayoutRenderer: ({
    bookingSidebarId,
    galleryCategories,
  }: {
    bookingSidebarId?: string;
    galleryCategories: Array<{ items: GalleryItem[] }>;
  }) => (
    <div
      data-booking-sidebar-id={bookingSidebarId}
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

const currentBookingMonthKey = "2026-07";
const bookingCalendars = {
  [currentBookingMonthKey]: {
    days: {},
    month: currentBookingMonthKey,
    status: "available",
  },
} satisfies Record<string, BookingCalendarMonth>;

const apiImage: VillaImage = {
  caption: "Pool",
  id: 2,
  imageName: "pool.jpg",
  imageUrl: "https://images.example.com/pool.jpg",
  isCover: false,
  zone: "outside",
};

const apiCoverImage: VillaImage = {
  caption: "Cover",
  id: 1,
  imageName: "cover.jpg",
  imageUrl: "https://images.example.com/supabase-cover.jpg",
  isCover: true,
  zone: "cover",
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
      bookingCalendars={bookingCalendars}
      contactSettings={DEFAULT_SITE_CONTACT_SETTINGS}
      currentBookingMonthKey={currentBookingMonthKey}
      id={id}
      galleryStyle={DEFAULT_SITE_WEB_STYLES.gallery}
      payload={makePayload(activeListing)}
      recommendedSection={null}
      settings={DEFAULT_SITE_SETTINGS}
    />
  );
}

function makePageWithInitialGalleryImages(
  initialGalleryImages: VillaImage[],
  id = listing.id,
  activeListing = listing,
) {
  return (
    <VillaDetailPage
      bookingCalendars={bookingCalendars}
      contactSettings={DEFAULT_SITE_CONTACT_SETTINGS}
      currentBookingMonthKey={currentBookingMonthKey}
      id={id}
      galleryStyle={DEFAULT_SITE_WEB_STYLES.gallery}
      initialGalleryImages={initialGalleryImages}
      payload={makePayload(activeListing)}
      recommendedSection={null}
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

function getGalleryImageFetchCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([input]) =>
    /^\/api\/villas\/[^/]+\/images$/.test(String(input)),
  );
}

function makeGalleryFetchMock(
  ...galleryResponses: Array<() => Response>
): ReturnType<typeof vi.fn> {
  let galleryResponseIndex = 0;

  return vi.fn((input: RequestInfo | URL) => {
    if (/^\/api\/villas\/[^/]+\/images$/.test(String(input))) {
      const responseFactory =
        galleryResponses[Math.min(galleryResponseIndex, galleryResponses.length - 1)] ??
        (() => makeJsonResponse({ images: [] }));
      galleryResponseIndex += 1;
      return Promise.resolve(responseFactory());
    }

    return Promise.resolve(makeJsonResponse({}));
  });
}

function stubIdleCallback() {
  let idleCallback: IdleRequestCallback | null = null;

  vi.stubGlobal(
    "requestIdleCallback",
    vi.fn((callback: IdleRequestCallback) => {
      idleCallback = callback;
      return 1;
    }),
  );
  vi.stubGlobal("cancelIdleCallback", vi.fn());

  return async () => {
    await act(async () => {
      idleCallback?.({ didTimeout: false, timeRemaining: () => 50 });
    });
    await flushReact();
  };
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
  const retryButton = container.querySelector(
    "[data-gallery-retry]",
  ) as HTMLButtonElement | null;
  const targetButton = galleryButton ?? retryButton;

  if (!targetButton) {
    throw new Error(
      'clickFirstGalleryItem expected a "[data-gallery-item]" or "[data-gallery-retry]" button to be present.',
    );
  }

  await act(async () => {
    targetButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flushReact();
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("VillaDetailPage deferred gallery loader", () => {
  it("places the mobile booking contact before the configurable detail layout", async () => {
    vi.stubGlobal("fetch", makeGalleryFetchMock(() => makeJsonResponse({ images: [] })));
    const page = renderPage();

    await page.render(makePage());
    await flushReact();

    const mobileBooking = page.container.querySelector(
      "[data-mobile-booking-contact]",
    );
    const detailLayout = page.container.querySelector("[data-detail-gallery-urls]");

    expect(mobileBooking).not.toBeNull();
    expect(mobileBooking?.querySelector("#contact")).not.toBeNull();
    expect(detailLayout?.getAttribute("data-booking-sidebar-id")).toBe(
      "desktop-contact",
    );
    expect(page.container.innerHTML.indexOf("data-mobile-booking-contact")).toBeLessThan(
      page.container.innerHTML.indexOf("data-detail-gallery-urls"),
    );

    await page.unmount();
  });

  it("does not render the listing API cover before Supabase images load", async () => {
    const fetchMock = makeGalleryFetchMock(() =>
      makeJsonResponse({ images: [apiImage] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const page = renderPage();

    await page.render(makePage());
    await flushReact();

    expect(getGalleryImageFetchCalls(fetchMock)).toHaveLength(0);
    expect(page.container.querySelector('[data-gallery-skeleton="true"]')).not.toBeNull();
    expect(page.container.querySelector("[data-gallery-item]")).toBeNull();
    expect(page.container.innerHTML).not.toContain(listing.coverImage);
    expect(
      page.container.querySelector("[data-detail-gallery-urls]")?.getAttribute(
        "data-detail-gallery-urls",
      ),
    ).not.toContain(apiImage.imageUrl);

    await page.unmount();
  });

  it("loads gallery images after the browser becomes idle", async () => {
    const fetchMock = makeGalleryFetchMock(() =>
      makeJsonResponse({ images: [apiCoverImage, apiImage] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const runIdleCallback = stubIdleCallback();
    const page = renderPage();

    await page.render(makePage());
    await flushReact();

    expect(getGalleryImageFetchCalls(fetchMock)).toHaveLength(0);

    await runIdleCallback();

    expect(getGalleryImageFetchCalls(fetchMock)).toHaveLength(1);
    expect(
      page.container.querySelector("[data-detail-gallery-urls]")?.getAttribute(
        "data-detail-gallery-urls",
      ),
    ).toContain(apiCoverImage.imageUrl);
    expect(page.container.querySelector("[data-gallery-item]")?.getAttribute(
      "data-gallery-item",
    )).toBe(apiCoverImage.imageUrl);

    await page.unmount();
  });

  it("renders initial gallery images before the idle gallery request", async () => {
    const fetchMock = makeGalleryFetchMock(() =>
      makeJsonResponse({ images: [apiCoverImage, apiImage] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const page = renderPage();

    await page.render(makePageWithInitialGalleryImages([apiCoverImage]));
    await flushReact();

    expect(getGalleryImageFetchCalls(fetchMock)).toHaveLength(0);
    expect(page.container.querySelector('[data-gallery-skeleton="true"]')).toBeNull();
    expect(page.container.querySelector("[data-gallery-item]")?.getAttribute(
      "data-gallery-item",
    )).toBe(apiCoverImage.imageUrl);
    expect(
      page.container.querySelector("[data-detail-gallery-urls]")?.getAttribute(
        "data-detail-gallery-urls",
      ),
    ).toContain(apiCoverImage.imageUrl);

    await page.unmount();
  });

  it("retries gallery loading after a transient API failure", async () => {
    const fetchMock = makeGalleryFetchMock(
      () => makeJsonResponse({ error: "temporary" }, 502),
      () => makeJsonResponse({ images: [apiImage] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const runIdleCallback = stubIdleCallback();
    const page = renderPage();

    await page.render(makePage());
    await flushReact();

    await runIdleCallback();

    expect(getGalleryImageFetchCalls(fetchMock)).toHaveLength(1);
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

    expect(getGalleryImageFetchCalls(fetchMock)).toHaveLength(2);
    expect(
      page.container.querySelector("[data-detail-gallery-urls]")?.getAttribute(
        "data-detail-gallery-urls",
      ),
    ).toContain(apiImage.imageUrl);

    await page.unmount();
  });

  it("shows a skeleton in the gallery area while gallery images are loading after interaction", async () => {
    const pendingResponse = deferred<Response>();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (/^\/api\/villas\/[^/]+\/images$/.test(String(input))) {
        return pendingResponse.promise;
      }

      return Promise.resolve(makeJsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);
    const runIdleCallback = stubIdleCallback();
    const page = renderPage();

    await page.render(makePage());
    await flushReact();

    await runIdleCallback();

    expect(page.container.querySelector('[data-gallery-skeleton="true"]')).not.toBeNull();
    expect(page.container.querySelector("[data-gallery-item]")).toBeNull();
    expect(page.container.querySelector('[data-gallery-load-status="loading"]')).toBeNull();

    pendingResponse.resolve(makeJsonResponse({ images: [apiImage] }));
    await flushReact();
    await page.unmount();
  });

  it("shows errors when an interactive gallery action reuses a failed background request", async () => {
    const pendingResponse = deferred<Response>();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (/^\/api\/villas\/[^/]+\/images$/.test(String(input))) {
        return pendingResponse.promise;
      }

      return Promise.resolve(makeJsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);
    const runIdleCallback = stubIdleCallback();
    const page = renderPage();

    await page.render(makePageWithInitialGalleryImages([apiCoverImage]));
    await flushReact();
    await runIdleCallback();
    await clickFirstGalleryItem(page.container);

    pendingResponse.resolve(makeJsonResponse({ error: "temporary" }, 502));
    await flushReact();

    expect(getGalleryImageFetchCalls(fetchMock)).toHaveLength(1);
    expect(page.container.querySelector("[data-gallery-load-status]")?.textContent).toContain(
      "ลองใหม่",
    );

    await page.unmount();
  });

  it("reuses loaded gallery images instead of issuing another request", async () => {
    const fetchMock = makeGalleryFetchMock(() =>
      makeJsonResponse({ images: [apiImage] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const runIdleCallback = stubIdleCallback();
    const page = renderPage();

    await page.render(makePage());
    await flushReact();
    expect(getGalleryImageFetchCalls(fetchMock)).toHaveLength(0);

    await runIdleCallback();

    expect(getGalleryImageFetchCalls(fetchMock)).toHaveLength(1);
    expect(page.container.querySelector("[data-lightbox-active]")).toBeNull();

    await clickFirstGalleryItem(page.container);

    expect(getGalleryImageFetchCalls(fetchMock)).toHaveLength(1);
    const classicLightbox = page.container.querySelector("[data-lightbox-active]");
    expect(classicLightbox).not.toBeNull();
    expect(
      classicLightbox?.getAttribute("data-lightbox-category-selector"),
    ).toBe("true");
    expect(
      classicLightbox?.getAttribute("data-lightbox-thumbnail-placement"),
    ).toBe("side");

    await clickFirstGalleryItem(page.container);

    expect(getGalleryImageFetchCalls(fetchMock)).toHaveLength(1);

    await page.unmount();
  });

  it("uses the categorized lightbox when a preview image is clicked directly", async () => {
    const fetchMock = makeGalleryFetchMock(() =>
      makeJsonResponse({ images: [apiCoverImage, apiImage] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const page = renderPage();

    await page.render(
      <VillaDetailPage
        bookingCalendars={bookingCalendars}
        contactSettings={DEFAULT_SITE_CONTACT_SETTINGS}
        currentBookingMonthKey={currentBookingMonthKey}
        galleryStyle={{ variant: "categorized-grid" }}
        id={listing.id}
        initialGalleryImages={[apiCoverImage]}
        payload={makePayload()}
        recommendedSection={null}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );
    await flushReact();

    await clickFirstGalleryItem(page.container);

    const categorizedLightbox = page.container.querySelector(
      "[data-lightbox-active]",
    );
    expect(categorizedLightbox).not.toBeNull();
    expect(
      categorizedLightbox?.getAttribute("data-lightbox-category-selector"),
    ).toBe("false");
    expect(
      categorizedLightbox?.getAttribute("data-lightbox-thumbnail-placement"),
    ).toBe("bottom");
    expect(page.container.querySelector('[data-gallery-overview="true"]')).toBeNull();

    await act(async () => {
      (page.container.querySelector("[data-lightbox-close]") as HTMLButtonElement).click();
    });
    await flushReact();

    expect(page.container.querySelector("[data-lightbox-active]")).toBeNull();
    expect(page.container.querySelector('[data-gallery-overview="true"]')).toBeNull();

    await page.unmount();
  });

  it("opens the categorized overview, continues to the lightbox, and returns to the overview", async () => {
    const fetchMock = makeGalleryFetchMock(() =>
      makeJsonResponse({ images: [apiCoverImage, apiImage] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const page = renderPage();

    await page.render(
      <VillaDetailPage
        bookingCalendars={bookingCalendars}
        contactSettings={DEFAULT_SITE_CONTACT_SETTINGS}
        currentBookingMonthKey={currentBookingMonthKey}
        galleryStyle={{ variant: "categorized-grid" }}
        id={listing.id}
        initialGalleryImages={[apiCoverImage]}
        payload={makePayload()}
        recommendedSection={null}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );
    await flushReact();

    await act(async () => {
      (page.container.querySelector("[data-gallery-view-all]") as HTMLButtonElement).click();
    });
    await flushReact();

    expect(page.container.querySelector('[data-gallery-overview="true"]')).not.toBeNull();
    expect(page.container.querySelector("[data-lightbox-active]")).toBeNull();

    await act(async () => {
      (page.container.querySelector("[data-overview-item]") as HTMLButtonElement).click();
    });
    await flushReact();

    expect(page.container.querySelector('[data-gallery-overview="true"]')).toBeNull();
    const categorizedLightbox = page.container.querySelector(
      "[data-lightbox-active]",
    );
    expect(categorizedLightbox).not.toBeNull();
    expect(
      categorizedLightbox?.getAttribute("data-lightbox-category-selector"),
    ).toBe("false");
    expect(
      categorizedLightbox?.getAttribute("data-lightbox-thumbnail-placement"),
    ).toBe("bottom");

    await act(async () => {
      (page.container.querySelector("[data-lightbox-close]") as HTMLButtonElement).click();
    });
    await flushReact();

    expect(page.container.querySelector('[data-gallery-overview="true"]')).not.toBeNull();
    expect(page.container.querySelector("[data-lightbox-active]")).toBeNull();
    expect(getGalleryImageFetchCalls(fetchMock)).toHaveLength(1);

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
    const runIdleCallback = stubIdleCallback();
    const page = renderPage();

    await page.render(makePage("9", listing));
    await flushReact();

    await runIdleCallback();
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
    const runIdleCallback = stubIdleCallback();
    const page = renderPage();

    await page.render(makePage("9", listing));
    await flushReact();
    await runIdleCallback();

    await page.render(makePage("10", villaTen));
    await flushReact();
    await runIdleCallback();

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
