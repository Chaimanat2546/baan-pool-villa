/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";

import {
  click,
  flushEffects,
  makeFetchMock,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";

const mocks = vi.hoisted(() => ({
  readAdminAccessToken: vi.fn(),
  replace: vi.fn(),
  router: {
    replace: vi.fn(),
  },
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span aria-label={alt} data-src={src} />
  ),
}));

vi.mock("@/components/admin/admin-auth", () => ({
  readAdminAccessToken: mocks.readAdminAccessToken,
}));

vi.mock("@/lib/home-sections/supabase", () => ({
  createBrowserHomeConfigClient: () => ({
    auth: {
      signOut: mocks.signOut,
    },
  }),
}));

import {
  AdminVillaCardHouseCustomPage,
  AdminVillaCardHouseListPage,
  AdminVillaCardImagesPage,
} from "../admin-villa-card-images-page";

describe("AdminVillaCardImagesPage", () => {
  beforeEach(() => {
    mocks.readAdminAccessToken.mockResolvedValue("admin-token");
    mocks.replace.mockReset();
    mocks.router.replace = mocks.replace;
    mocks.signOut.mockReset();
    mocks.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows card style setup without default/recommended/custom mode choices", async () => {
    const fetchMock = makeFetchMock([
      {
        body: {
          settings: {
            ...DEFAULT_SITE_SETTINGS,
            villaCardStyle: "classic",
          },
        },
        url: "/api/admin/site-settings",
      },
      {
        body: {
          settings: {
            ...DEFAULT_SITE_SETTINGS,
            villaCardStyle: "gallery",
          },
        },
        method: "PUT",
        url: "/api/admin/site-settings",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminVillaCardImagesPage />);
    await flushEffects();

    expect(
      page.container.querySelector('[name="villa-card-image-mode"]'),
    ).toBeNull();
    expect(
      page.container.querySelector("[data-villa-card-save-mode]"),
    ).toBeNull();
    expect(
      page.container.querySelector('[data-villa-card-preview-option="gallery"]'),
    ).not.toBeNull();
    const galleryOption = page.container
      .querySelector('[data-villa-card-preview-option="gallery"]')
      ?.closest("div");
    expect(
      galleryOption
        ?.querySelector("[data-villa-card-house-list-link]")
        ?.getAttribute("href"),
    ).toBe("/admin/card-images/houses");

    await click(
      page.container.querySelector(
        '[data-villa-card-preview-option="gallery"]',
      ) as HTMLElement,
    );
    await click(
      page.container.querySelector("[data-villa-card-save-style]") as HTMLElement,
    );

    const saveCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === "/api/admin/site-settings" &&
        (init as RequestInit | undefined)?.method === "PUT",
    );
    const body = (saveCall?.[1] as RequestInit).body as FormData;

    expect(body.get("villaCardStyle")).toBe("gallery");

    await page.unmount();
  });

  it("paginates the custom house list with clickable page numbers", async () => {
    const houses = Array.from({ length: 61 }, (_, index) => {
      const id = String(index + 1);

      return {
        id,
        title: `บ้านพัก ${id}`,
        zoneLabel: "พัทยา",
      };
    });
    const pageBody = (pageNumber: number) => ({
      configs: [],
      houses: houses.slice((pageNumber - 1) * 7, pageNumber * 7),
      pagination: {
        hasMore: pageNumber < 9,
        page: pageNumber,
        pageCount: 9,
        pageSize: 7,
        search: "",
        total: 61,
      },
    });
    const fetchMock = makeFetchMock([
      {
        body: pageBody(1),
        url: "/api/admin/villa-card-images?page=1&pageSize=7",
      },
      {
        body: pageBody(2),
        url: "/api/admin/villa-card-images?page=2&pageSize=7",
      },
      {
        body: pageBody(3),
        url: "/api/admin/villa-card-images?page=3&pageSize=7",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminVillaCardHouseListPage />);
    await flushEffects();

    expect(
      page.container
        .querySelector("[data-villa-card-back-link]")
        ?.getAttribute("href"),
    ).toBe("/admin/card-images");
    expect(
      page.container.querySelector('[data-villa-card-house-option="1"]'),
    ).not.toBeNull();
    expect(
      page.container.querySelector('[data-villa-card-house-option="8"]'),
    ).toBeNull();
    expect(
      page.container.querySelector("[data-villa-card-house-page-info]"),
    ).toBeNull();
    expect(
      page.container.querySelector('[data-villa-card-house-page-button="2"]'),
    ).not.toBeNull();
    expect(
      page.container.querySelector('[data-villa-card-house-page-button="4"]'),
    ).toBeNull();
    expect(
      page.container.querySelector('[data-villa-card-house-page-button="9"]'),
    ).not.toBeNull();
    expect(
      page.container.querySelector("[data-villa-card-house-page-ellipsis]")
        ?.textContent,
    ).toBe("...");
    expect(
      page.container
        .querySelector("[data-villa-card-house-pagination]")
        ?.getAttribute("aria-label"),
    ).toBe("pagination");
    expect(
      page.container.querySelector("[data-villa-card-house-pagination] ul"),
    ).not.toBeNull();
    expect(
      page.container.querySelector("[data-villa-card-house-page-prev]")
        ?.textContent,
    ).toContain("ก่อนหน้า");
    expect(
      page.container.querySelector("[data-villa-card-house-page-next]")
        ?.textContent,
    ).toContain("ถัดไป");

    await click(
      page.container.querySelector(
        '[data-villa-card-house-page-button="2"]',
      ) as HTMLButtonElement,
    );
    await flushEffects();

    expect(
      page.container.querySelector('[data-villa-card-house-option="8"]'),
    ).not.toBeNull();
    expect(
      page.container
        .querySelector('[data-villa-card-house-page-button="2"]')
        ?.getAttribute("aria-current"),
    ).toBe("page");

    await click(
      page.container.querySelector(
        "[data-villa-card-house-page-next]",
      ) as HTMLButtonElement,
    );
    await flushEffects();

    expect(
      page.container.querySelector('[data-villa-card-house-option="1"]'),
    ).toBeNull();
    expect(
      page.container.querySelector('[data-villa-card-house-option="15"]'),
    ).not.toBeNull();
    expect(
      page.container
        .querySelector('[data-villa-card-house-page-button="3"]')
        ?.getAttribute("aria-current"),
    ).toBe("page");

    await page.unmount();
  });

  it("shows a top-aligned skeleton while the custom house list loads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );

    const page = await mountAdminPage(<AdminVillaCardHouseListPage />);

    expect(
      page.container.querySelector("[data-villa-card-house-list-skeleton]"),
    ).not.toBeNull();
    expect(
      page.container.querySelectorAll(
        "[data-villa-card-house-list-skeleton-row]",
      ),
    ).toHaveLength(7);
    expect(
      page.container.querySelector("[data-villa-card-house-list]")?.className,
    ).toContain("content-start");
    expect(
      page.container.querySelector("[data-villa-card-house-list]")?.className,
    ).toContain("auto-rows-max");

    await page.unmount();
  });

  it("shows a top-centered empty state when no houses match", async () => {
    const fetchMock = makeFetchMock([
      {
        body: {
          configs: [],
          houses: [],
          pagination: {
            hasMore: false,
            page: 1,
            pageCount: 1,
            pageSize: 7,
            search: "",
            total: 0,
          },
        },
        url: "/api/admin/villa-card-images?page=1&pageSize=7",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminVillaCardHouseListPage />);
    await flushEffects();

    const emptyState = page.container.querySelector(
      "[data-villa-card-house-empty]",
    );

    expect(emptyState).not.toBeNull();
    expect(emptyState?.className).toContain("items-center");
    expect(emptyState?.className).toContain("justify-start");
    expect(emptyState?.querySelector("svg")).not.toBeNull();
    expect(emptyState?.textContent).toContain("ไม่พบบ้านพัก");

    await page.unmount();
  });

  it("loads one house from the route and lets admins select thumbnails", async () => {
    const fetchMock = makeFetchMock([
      {
        body: {
          configs: [],
          houses: [
            {
              id: "9",
              title: "บ้านพัก 9",
              zoneLabel: "พัทยา",
            },
          ],
          pagination: {
            hasMore: false,
            page: 1,
            pageCount: 1,
            pageSize: 1,
            search: "",
            total: 1,
          },
        },
        url: "/api/admin/villa-card-images?houseId=9",
      },
      {
        body: {
          images: [
            {
              id: 10,
              imageName: "cover.jpg",
              imageUrl: "https://images.example.com/cover.jpg",
              zone: "outside",
            },
            {
              id: 20,
              imageName: "pool.jpg",
              imageUrl: "https://images.example.com/pool.jpg",
              zone: "outside",
            },
            {
              id: 30,
              imageName: "bedroom.jpg",
              imageUrl: "https://images.example.com/bedroom.jpg",
              zone: "inside",
            },
          ],
        },
        url: "/api/villas/9/images",
      },
      {
        body: {
          config: {
            houseId: "9",
            id: "config-1",
            imageIds: [30, 10, 20],
            isActive: true,
            pageKey: "default",
          },
        },
        method: "PUT",
        url: "/api/admin/villa-card-images",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(
      <AdminVillaCardHouseCustomPage houseId="9" />,
    );
    await flushEffects();

    expect(
      page.container.querySelector("[data-villa-card-house-id-input]"),
    ).toBeNull();

    const coverButton = page.container.querySelector(
      '[data-villa-card-image-option="10"]',
    ) as HTMLButtonElement | null;

    expect(coverButton).not.toBeNull();
    await click(coverButton as HTMLButtonElement);
    await click(
      page.container.querySelector(
        '[data-villa-card-image-option="20"]',
      ) as HTMLButtonElement,
    );
    expect(
      coverButton
        ?.querySelector("[data-villa-card-image-frame]")
        ?.querySelector("[data-villa-card-selected-index]")
        ?.textContent,
    ).toBe("#1");

    const insideZoneButton = page.container.querySelector(
      '[data-villa-card-zone-option="inside"]',
    ) as HTMLButtonElement | null;

    expect(insideZoneButton).not.toBeNull();
    expect(
      page.container.querySelector('[data-villa-card-zone-option="outside"]')
        ?.textContent,
    ).toContain("ภายนอกบ้าน");
    expect(insideZoneButton?.textContent).toContain("ภายในบ้าน");
    await click(insideZoneButton as HTMLButtonElement);

    expect(
      page.container.querySelector('[data-villa-card-image-option="10"]'),
    ).toBeNull();
    await click(
      page.container.querySelector(
        '[data-villa-card-image-option="30"]',
      ) as HTMLButtonElement,
    );

    expect(
      page.container.querySelector("[data-villa-card-selected-images]"),
    ).toBeNull();
    expect(
      page.container.querySelector("[data-villa-card-image-grid]")?.className,
    ).toContain("overflow-y-auto");
    expect(page.container.textContent).not.toContain("Custom ที่บันทึกไว้");

    await click(
      page.container.querySelector("[data-villa-card-save-custom]") as HTMLButtonElement,
    );

    const confirmDialog = page.container.querySelector(
      "[data-villa-card-confirm-dialog]",
    );
    expect(confirmDialog).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/admin/villa-card-images",
      expect.objectContaining({ method: "PUT" }),
    );

    act(() => {
      page.container
        .querySelector('[data-villa-card-confirm-image="30"]')
        ?.dispatchEvent(new Event("dragstart", { bubbles: true }));
      page.container
        .querySelector('[data-villa-card-confirm-image="10"]')
        ?.dispatchEvent(new Event("dragover", { bubbles: true }));
    });
    await flushEffects();

    expect(
      page.container
        .querySelector("[data-villa-card-confirm-order]")
        ?.getAttribute("data-villa-card-confirm-order"),
    ).toBe("30,10,20");

    await click(
      page.container.querySelector(
        "[data-villa-card-confirm-save]",
      ) as HTMLButtonElement,
    );

    const saveCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === "/api/admin/villa-card-images" &&
        (init as RequestInit | undefined)?.method === "PUT",
    );
    expect(JSON.parse(String((saveCall?.[1] as RequestInit).body))).toEqual({
      houseId: "9",
      imageIds: [30, 10, 20],
      isActive: true,
    });

    await page.unmount();
  });
});
