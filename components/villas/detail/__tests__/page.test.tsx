/**
 * @vitest-environment jsdom
 */
import { act, type ComponentType, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const { galleryLightboxRenderMock } = vi.hoisted(() => ({
  galleryLightboxRenderMock: vi.fn(),
}));

vi.mock("next/dynamic", async () => {
  const { createElement, lazy, Suspense } = await import("react");

  return {
    default: <Props extends object>(loader: () => Promise<ComponentType<Props>>) => {
      const DynamicComponent = lazy(async () => ({
        default: await loader(),
      }));

      return (props: Props) =>
        createElement(
          Suspense,
          { fallback: null },
          createElement(DynamicComponent, props),
        );
    },
  };
});

vi.mock("../gallery", () => ({
  Gallery: ({
    items,
    onImageClick,
    onImageError,
    onViewAll,
    totalImageCount,
  }: {
    items: GalleryItem[];
    onImageClick: (item: GalleryItem) => void;
    onImageError: (imageUrl: string) => void;
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
      <button
        data-gallery-image-error
        type="button"
        onClick={() => {
          const firstItem = items[0];
          if (firstItem) {
            onImageError(firstItem.url);
          }
        }}
      >
        fail first image
      </button>
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
  }) => {
    galleryLightboxRenderMock();

    return activeItem ? (
      <div
        data-lightbox-active={activeItem.url}
        data-lightbox-category-selector={String(showCategorySelector)}
        data-lightbox-thumbnail-placement={thumbnailPlacement}
      >
        <button data-lightbox-close type="button" onClick={onClose}>
          close
        </button>
      </div>
    ) : null;
  },
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
    <div
      data-gallery-overview="true"
      data-gallery-overview-urls={categories
        .flatMap((category) => category.items.map((item) => item.url))
        .join("|")}
    >
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

vi.mock("../gallery-lightbox", () => ({
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
  }) => {
    galleryLightboxRenderMock();

    return activeItem ? (
      <div
        data-lightbox-active={activeItem.url}
        data-lightbox-category-selector={String(showCategorySelector)}
        data-lightbox-thumbnail-placement={thumbnailPlacement}
      >
        <button data-lightbox-close type="button" onClick={onClose}>
          close
        </button>
      </div>
    ) : null;
  },
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
  imageUrl: "/api/villas/9/images?imageId=2",
  isCover: false,
  zone: "outside",
};

const apiCoverImage: VillaImage = {
  caption: "Cover",
  id: 1,
  imageName: "cover.jpg",
  imageUrl: "/api/villas/9/images?imageId=1",
  isCover: true,
  zone: "cover",
};

const serverGalleryImages: VillaImage[] = [
  {
    caption: "Bedroom",
    id: 3,
    imageName: "bedroom.jpg",
    imageUrl: "/api/villas/9/images?imageId=3",
    isCover: false,
    zone: "inside",
  },
  apiImage,
  {
    caption: "Review",
    id: 5,
    imageName: "review.jpg",
    imageUrl: "/api/villas/9/images?imageId=5",
    isCover: false,
    zone: "review",
  },
  apiCoverImage,
  {
    caption: "Kitchen",
    id: 4,
    imageName: "kitchen.jpg",
    imageUrl: "/api/villas/9/images?imageId=4",
    isCover: false,
    zone: "inside",
  },
];

const fetchMock = vi.fn();
const requestIdleCallbackMock = vi.fn(() => 1);

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
  await vi.dynamicImportSettled();
  await act(async () => undefined);
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
  initialGalleryLoadFailed = false,
) {
  return (
    <VillaDetailPage
      bookingCalendars={bookingCalendars}
      contactSettings={DEFAULT_SITE_CONTACT_SETTINGS}
      currentBookingMonthKey={currentBookingMonthKey}
      id={id}
      galleryStyle={DEFAULT_SITE_WEB_STYLES.gallery}
      initialGalleryImages={initialGalleryImages}
      initialGalleryLoadFailed={initialGalleryLoadFailed}
      payload={makePayload(activeListing)}
      recommendedSection={null}
      settings={DEFAULT_SITE_SETTINGS}
    />
  );
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

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ images: serverGalleryImages }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }),
  );
  requestIdleCallbackMock.mockClear();
  galleryLightboxRenderMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("requestIdleCallback", requestIdleCallbackMock);
  vi.stubGlobal("cancelIdleCallback", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("VillaDetailPage server gallery", () => {
  it("does not render the lightbox before a gallery item is selected", async () => {
    const page = renderPage();

    await page.render(makePageWithInitialGalleryImages(serverGalleryImages));
    await flushReact();

    expect(galleryLightboxRenderMock).not.toHaveBeenCalled();

    await page.unmount();
  });

  it("places the mobile booking contact before the configurable detail layout", async () => {
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

  it("renders every supplied server image immediately and keeps the cover first", async () => {
    const page = renderPage();

    await page.render(makePageWithInitialGalleryImages(serverGalleryImages));
    await flushReact();

    expect(requestIdleCallbackMock).not.toHaveBeenCalled();
    expect(page.container.querySelector('[data-gallery-skeleton="true"]')).toBeNull();
    expect(page.container.querySelector("[data-gallery-item]")?.getAttribute(
      "data-gallery-item",
    )).toBe(apiCoverImage.imageUrl);
    expect(page.container.querySelector("[data-gallery-items]")?.getAttribute(
      "data-gallery-total",
    )).toBe("5");
    expect(
      page.container
        .querySelector("[data-detail-gallery-urls]")
        ?.getAttribute("data-detail-gallery-urls")
        ?.split("|"),
    ).toEqual([
      "/api/villas/9/images?imageId=1",
      "/api/villas/9/images?imageId=2",
      "/api/villas/9/images?imageId=3",
      "/api/villas/9/images?imageId=4",
      "/api/villas/9/images?imageId=5",
    ]);

    await page.unmount();
  });

  it("keeps the detail cover visible when its gallery category is disabled", async () => {
    const page = renderPage();

    await page.render(
      <VillaDetailPage
        bookingCalendars={bookingCalendars}
        contactSettings={DEFAULT_SITE_CONTACT_SETTINGS}
        currentBookingMonthKey={currentBookingMonthKey}
        galleryStyle={{ ...DEFAULT_SITE_WEB_STYLES.gallery, showCover: false }}
        id={listing.id}
        initialGalleryImages={serverGalleryImages}
        payload={makePayload()}
        recommendedSection={null}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );
    await flushReact();

    expect(page.container.querySelector("[data-gallery-item]")?.getAttribute(
      "data-gallery-item",
    )).toBe(apiCoverImage.imageUrl);
    expect(
      page.container
        .querySelector("[data-detail-gallery-urls]")
        ?.getAttribute("data-detail-gallery-urls"),
    ).not.toContain(apiCoverImage.imageUrl);

    await page.unmount();
  });

  it("ignores configured preview images when the standard source is selected", async () => {
    const page = renderPage();
    const configuredPreview = {
      ...apiImage,
      id: 99,
      imageUrl: "/api/villas/9/images?imageId=99",
    };

    await page.render(
      <VillaDetailPage
        bookingCalendars={bookingCalendars}
        contactSettings={DEFAULT_SITE_CONTACT_SETTINGS}
        currentBookingMonthKey={currentBookingMonthKey}
        galleryStyle={DEFAULT_SITE_WEB_STYLES.gallery}
        id={listing.id}
        initialGalleryImages={serverGalleryImages}
        initialGalleryPreviewImages={[configuredPreview]}
        payload={makePayload()}
        recommendedSection={null}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );
    await flushReact();

    expect(
      page.container.querySelector("[data-gallery-items]")?.getAttribute(
        "data-gallery-items",
      ),
    ).not.toContain(configuredPreview.imageUrl);
    expect(
      page.container
        .querySelector("[data-detail-gallery-urls]")
        ?.getAttribute("data-detail-gallery-urls")
        ?.split("|"),
    ).toEqual([
      "/api/villas/9/images?imageId=1",
      "/api/villas/9/images?imageId=2",
      "/api/villas/9/images?imageId=3",
      "/api/villas/9/images?imageId=4",
      "/api/villas/9/images?imageId=5",
    ]);

    await page.unmount();
  });

  it("keeps the configured system image order in the small header preview tiles", async () => {
    const page = renderPage();
    const systemPreviewImages: VillaImage[] = [
      apiCoverImage,
      {
        ...apiImage,
        id: 12,
        imageUrl: "/api/villas/9/images?imageId=12",
        zone: "inside",
      },
      {
        ...apiImage,
        id: 13,
        imageUrl: "/api/villas/9/images?imageId=13",
        zone: "outside",
      },
      {
        ...apiImage,
        id: 14,
        imageUrl: "/api/villas/9/images?imageId=14",
        zone: "review",
      },
    ];

    await page.render(
      <VillaDetailPage
        bookingCalendars={bookingCalendars}
        contactSettings={DEFAULT_SITE_CONTACT_SETTINGS}
        currentBookingMonthKey={currentBookingMonthKey}
        galleryStyle={{ ...DEFAULT_SITE_WEB_STYLES.gallery, imageSource: "system" }}
        id={listing.id}
        initialGalleryImages={serverGalleryImages}
        initialGalleryPreviewImages={systemPreviewImages}
        payload={makePayload()}
        recommendedSection={null}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );
    await flushReact();

    expect(
      page.container.querySelector("[data-gallery-items]")?.getAttribute(
        "data-gallery-items",
      )?.split("|"),
    ).toEqual(systemPreviewImages.map((image) => image.imageUrl));

    await page.unmount();
  });

  it("renders a successful empty server gallery without a skeleton", async () => {
    const page = renderPage();

    await page.render(makePageWithInitialGalleryImages([]));
    await flushReact();

    expect(page.container.querySelector('[data-gallery-skeleton="true"]')).toBeNull();
    expect(page.container.querySelector("[data-gallery-item]")).toBeNull();
    expect(page.container.querySelector("[data-gallery-retry]")).not.toBeNull();

    await page.unmount();
  });

  it("renders an explicit error when the server gallery dependency fails", async () => {
    const page = renderPage();

    await page.render(
      makePageWithInitialGalleryImages([], listing.id, listing, true),
    );
    await flushReact();

    expect(page.container.querySelector('[data-gallery-skeleton="true"]')).toBeNull();
    expect(
      page.container.querySelector('[data-gallery-load-status="error"]'),
    ).not.toBeNull();

    await page.unmount();
  });

  it("renders gallery retry controls as normal document links", async () => {
    const page = renderPage();

    await page.render(
      makePageWithInitialGalleryImages([], listing.id, listing, true),
    );
    await flushReact();

    expect(page.container.querySelector("[data-gallery-load-status]")?.textContent).toContain(
      "ลองใหม่",
    );

    const retryControls = Array.from(
      page.container.querySelectorAll("[data-gallery-retry]"),
    );
    expect(retryControls).toHaveLength(2);
    for (const retryControl of retryControls) {
      expect(retryControl.tagName).toBe("A");
      expect(retryControl.getAttribute("href")).toBe("/villas/9");
    }
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        /^\/api\/villas\/[^/]+\/images$/.test(String(input)),
      ),
    ).toHaveLength(0);

    await page.unmount();
  });

  it("opens the classic lightbox from the supplied server images", async () => {
    const page = renderPage();

    await page.render(makePageWithInitialGalleryImages(serverGalleryImages));
    await flushReact();
    await clickFirstGalleryItem(page.container);

    const classicLightbox = page.container.querySelector("[data-lightbox-active]");
    expect(classicLightbox?.getAttribute("data-lightbox-active")).toBe(
      apiCoverImage.imageUrl,
    );
    expect(
      classicLightbox?.getAttribute("data-lightbox-category-selector"),
    ).toBe("true");
    expect(
      classicLightbox?.getAttribute("data-lightbox-thumbnail-placement"),
    ).toBe("side");
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        /^\/api\/villas\/[^/]+\/images$/.test(String(input)),
      ),
    ).toHaveLength(0);

    await page.unmount();
  });

  it("uses the categorized lightbox when a preview image is clicked directly", async () => {
    const page = renderPage();

    await page.render(
      <VillaDetailPage
        bookingCalendars={bookingCalendars}
        contactSettings={DEFAULT_SITE_CONTACT_SETTINGS}
        currentBookingMonthKey={currentBookingMonthKey}
        galleryStyle={{ variant: "categorized-grid" }}
        id={listing.id}
        initialGalleryImages={serverGalleryImages}
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
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        /^\/api\/villas\/[^/]+\/images$/.test(String(input)),
      ),
    ).toHaveLength(0);

    await page.unmount();
  });

  it("opens the categorized overview, continues to the lightbox, and returns to the overview", async () => {
    const page = renderPage();

    await page.render(
      <VillaDetailPage
        bookingCalendars={bookingCalendars}
        contactSettings={DEFAULT_SITE_CONTACT_SETTINGS}
        currentBookingMonthKey={currentBookingMonthKey}
        galleryStyle={{ variant: "categorized-grid" }}
        id={listing.id}
        initialGalleryImages={serverGalleryImages}
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
    expect(
      page.container
        .querySelector("[data-gallery-overview-urls]")
        ?.getAttribute("data-gallery-overview-urls")
        ?.split("|"),
    ).toEqual([
      "/api/villas/9/images?imageId=1",
      "/api/villas/9/images?imageId=2",
      "/api/villas/9/images?imageId=3",
      "/api/villas/9/images?imageId=4",
      "/api/villas/9/images?imageId=5",
    ]);

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
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        /^\/api\/villas\/[^/]+\/images$/.test(String(input)),
      ),
    ).toHaveLength(0);

    await page.unmount();
  });

  it("resets villa gallery UI state after navigating away and back", async () => {
    const villaTen: VillaListing = {
      ...listing,
      coverImage: "https://images.example.com/cover-10.jpg",
      id: "10",
    };
    const imageForTen = {
      ...apiImage,
      id: 10,
      imageUrl: "/api/villas/10/images?imageId=10",
    };
    const page = renderPage();

    await page.render(
      makePageWithInitialGalleryImages(serverGalleryImages, "9", listing),
    );
    await flushReact();
    await clickFirstGalleryItem(page.container);

    expect(page.container.querySelector("[data-lightbox-active]")).not.toBeNull();

    await act(async () => {
      (
        page.container.querySelector(
          "[data-gallery-image-error]",
        ) as HTMLButtonElement
      ).click();
    });
    await flushReact();

    expect(
      page.container.querySelector("[data-detail-gallery-urls]")?.getAttribute(
        "data-detail-gallery-urls",
      ),
    ).not.toContain(apiCoverImage.imageUrl);

    await page.render(
      makePageWithInitialGalleryImages([imageForTen], "10", villaTen),
    );
    await flushReact();

    expect(page.container.querySelector("[data-lightbox-active]")).toBeNull();
    expect(
      page.container.querySelector("[data-detail-gallery-urls]")?.getAttribute(
        "data-detail-gallery-urls",
      ),
    ).toBe(imageForTen.imageUrl);
    expect(page.container.innerHTML).not.toContain(apiImage.imageUrl);

    await page.render(
      makePageWithInitialGalleryImages(serverGalleryImages, "9", listing),
    );
    await flushReact();

    expect(page.container.querySelector("[data-lightbox-active]")).toBeNull();
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

});
