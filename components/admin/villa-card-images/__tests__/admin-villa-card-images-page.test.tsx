/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";

import {
  click,
  flushEffects,
  makeFetchMock,
  makeJsonResponse,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";

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
    window.history.replaceState(null, "", "/");
    mocks.readAdminAccessToken.mockResolvedValue("admin-token");
    mocks.replace.mockReset();
    mocks.router.replace = mocks.replace;
    mocks.signOut.mockReset();
    mocks.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    document.body.style.overflow = "";
    vi.unstubAllGlobals();
  });

  it("shows card style setup without default/recommended/custom mode choices", async () => {
    const fetchMock = makeFetchMock([
      {
        body: {
          configs: [],
          houses: [],
          pagination: { hasMore: false, page: 1, pageCount: 1, pageSize: 10, search: "", total: 0 },
          villaCardStyle: "classic",
        },
        url: "/api/admin/villa-card-images",
      },
      {
        body: { villaCardStyle: "gallery" },
        method: "PUT",
        url: "/api/admin/villa-card-images",
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
    expect(
      page.container
        .querySelector("[data-villa-card-house-list-link]")
        ?.getAttribute("href"),
    ).toBe("/admin/card-images/houses");
    expect(
      page.container.querySelector(
        '[data-villa-card-preview-option="gallery"] [data-villa-card-house-list-link]',
      ),
    ).toBeNull();
    const galleryRadio = page.container.querySelector<HTMLInputElement>(
      '[name="villaCardStyle"][value="gallery"]',
    );
    expect(galleryRadio).not.toBeNull();
    expect(galleryRadio?.checked).toBe(false);
    expect(
      page.container.querySelector('[data-villa-card-selected-state="classic"]'),
    ).not.toBeNull();
    expect(
      page.container.querySelectorAll("[data-villa-card-style-preview]"),
    ).toHaveLength(1);
    expect(
      page.container.querySelector("[data-villa-card-selected-preview]"),
    ).not.toBeNull();
    expect(
      page.container.querySelector("[data-villa-card-style-options]"),
    ).not.toBeNull();
    expect(
      page.container.querySelector("[data-villa-card-style-options]")?.className,
    ).toContain("lg:grid-rows-2");
    expect(
      (page.container.querySelector("[data-villa-card-save-style]") as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await click(
      page.container.querySelector(
        '[data-villa-card-preview-option="gallery"]',
      ) as HTMLElement,
    );
    expect(
      page.container.querySelector<HTMLInputElement>(
        '[name="villaCardStyle"][value="gallery"]',
      )?.checked,
    ).toBe(true);
    expect(
      page.container.querySelector('[data-villa-card-selected-state="gallery"]'),
    ).not.toBeNull();
    expect(
      (page.container.querySelector("[data-villa-card-save-style]") as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    await click(
      page.container.querySelector("[data-villa-card-save-style]") as HTMLElement,
    );
    expect(
      (page.container.querySelector("[data-villa-card-save-style]") as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    const saveCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === "/api/admin/villa-card-images" &&
        (init as RequestInit | undefined)?.method === "PUT",
    );
    expect(JSON.parse(String((saveCall?.[1] as RequestInit).body))).toEqual({
      villaCardStyle: "gallery",
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/admin/site-settings",
      expect.anything(),
    );

    await page.unmount();
  });

  it("renders card style controls as a settings section when embedded", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock([
        {
          body: { villaCardStyle: "classic" },
          url: "/api/admin/villa-card-images",
        },
      ]),
    );

    const page = await mountAdminPage(<AdminVillaCardImagesPage embedded />);
    await flushEffects();

    expect(page.container.querySelector("h1")).toBeNull();
    expect(page.container.textContent).not.toContain("Card images");
    expect(
      page.container.querySelector("[data-villa-card-house-list-link]"),
    ).not.toBeNull();

    await page.unmount();
  });

  it("keeps card style saving disabled when its initial load fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeJsonResponse({ body: { errors: ["Unable to load settings"] }, status: 500 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminVillaCardImagesPage />);
    await flushEffects();

    expect(
      page.container.querySelector<HTMLButtonElement>("[data-villa-card-save-style]")
        ?.disabled,
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

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
      configs: pageNumber === 1
        ? [
            {
              houseId: "1",
              id: "config-1",
              imageIds: [1, 2, 3],
              isActive: true,
              pageKey: "global",
            },
          ]
        : [],
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

    const backLink = page.container.querySelector("[data-villa-card-back-link]");
    expect(backLink?.getAttribute("href")).toBe("/admin/card-images");
    expect(backLink?.textContent).toContain("กลับไปตั้งค่าการ์ดบ้าน");
    expect(backLink?.className).not.toContain("rounded-md");
    expect(page.container.textContent).not.toContain("Card images");
    expect(`${window.location.pathname}${window.location.search}`).toBe(
      "/admin/card-images/houses",
    );
    expect(
      page.container.querySelector('[data-villa-card-house-option="1"]'),
    ).not.toBeNull();
    expect(
      page.container.querySelector("[data-villa-card-house-card-list]"),
    ).not.toBeNull();
    expect(
      page.container.querySelector("[data-villa-card-house-card-list]")
        ?.className,
    ).toContain("grid-cols-2");
    expect(
      page.container.querySelector("[data-villa-card-house-card-list]")
        ?.className,
    ).toContain("sm:grid-cols-1");
    expect(
      page.container.querySelector('[data-villa-card-house-option="1"]')
        ?.className,
    ).toContain("grid");
    expect(
      page.container.querySelector('[data-villa-card-house-option="1"]')
        ?.className,
    ).toContain("sm:flex");
    expect(
      page.container.querySelector('[data-villa-card-house-option="1"] [data-villa-card-house-thumb]')
        ?.className,
    ).toContain("h-24");
    expect(
      page.container.querySelector('[data-villa-card-house-option="1"]')
        ?.textContent,
    ).toContain("ตั้งค่าแล้ว");
    expect(
      page.container.querySelector('[data-villa-card-house-option="1"]')
        ?.textContent,
    ).not.toContain("custom");
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
    expect(`${window.location.pathname}${window.location.search}`).toBe(
      "/admin/card-images/houses?page=2",
    );
    expect(
      page.container
        .querySelector('[data-villa-card-house-option="8"]')
        ?.getAttribute("href"),
    ).toBe("/admin/card-images/houses/8?page=2");
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
    expect(`${window.location.pathname}${window.location.search}`).toBe(
      "/admin/card-images/houses?page=3",
    );
    expect(
      page.container
        .querySelector('[data-villa-card-house-page-button="3"]')
        ?.getAttribute("aria-current"),
    ).toBe("page");

    await page.unmount();
  });

  it("disables custom house pagination while a new page is loading", async () => {
    const houses = Array.from({ length: 14 }, (_, index) => {
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
        hasMore: pageNumber < 2,
        page: pageNumber,
        pageCount: 2,
        pageSize: 7,
        search: "",
        total: 14,
      },
    });
    let resolvePageTwo: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const requestUrl = input instanceof Request ? input.url : String(input);

      if (requestUrl === "/api/admin/villa-card-images?page=1&pageSize=7") {
        return Promise.resolve(makeJsonResponse({ body: pageBody(1) }));
      }

      if (requestUrl === "/api/admin/villa-card-images?page=2&pageSize=7") {
        return new Promise<Response>((resolve) => {
          resolvePageTwo = resolve;
        });
      }

      return Promise.resolve(
        makeJsonResponse({
          body: { error: `Unhandled ${requestUrl}` },
          status: 500,
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminVillaCardHouseListPage />);
    await flushEffects();

    const pageTwoButton = page.container.querySelector(
      '[data-villa-card-house-page-button="2"]',
    ) as HTMLButtonElement;
    await click(pageTwoButton);
    await flushEffects();

    expect(pageTwoButton.disabled).toBe(true);
    expect(
      (
        page.container.querySelector(
          "[data-villa-card-house-page-prev]",
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        page.container.querySelector(
          "[data-villa-card-house-page-next]",
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    resolvePageTwo(makeJsonResponse({ body: pageBody(2) }));
    await flushEffects();

    expect(
      page.container.querySelector('[data-villa-card-house-option="8"]'),
    ).not.toBeNull();

    await page.unmount();
  });

  it("restores the custom house list page from URL state", async () => {
    const fetchMock = makeFetchMock([
      {
        body: {
          configs: [],
          houses: [
            {
              id: "9",
              title: "House 9",
              zoneLabel: "Pattaya",
            },
          ],
          pagination: {
            hasMore: true,
            page: 2,
            pageCount: 3,
            pageSize: 7,
            search: "9",
            total: 15,
          },
        },
        url: "/api/admin/villa-card-images?page=2&pageSize=7&search=9",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(
      <AdminVillaCardHouseListPage initialPage="2" initialSearch="9" />,
    );
    await flushEffects();

    expect(
      page.container.querySelector('[data-villa-card-house-option="9"]'),
    ).not.toBeNull();
    expect(
      page.container
        .querySelector('[data-villa-card-house-option="9"]')
        ?.getAttribute("href"),
    ).toBe("/admin/card-images/houses/9?page=2&search=9");
    expect(`${window.location.pathname}${window.location.search}`).toBe(
      "/admin/card-images/houses?page=2&search=9",
    );

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
      page.container.querySelector("[data-villa-card-house-list-skeleton]")
        ?.className,
    ).toContain("col-span-full");
    expect(
      page.container.querySelector("[data-villa-card-house-list-skeleton]")
        ?.className,
    ).toContain("grid-cols-2");
    expect(
      page.container.querySelector("[data-villa-card-house-list-skeleton]")
        ?.className,
    ).toContain("sm:grid-cols-1");
    expect(
      page.container.querySelectorAll(
        "[data-villa-card-house-list-skeleton-row]",
      ),
    ).toHaveLength(7);
    expect(
      page.container.querySelector("[data-villa-card-house-list-skeleton-row]")
        ?.className,
    ).toContain("grid");
    expect(
      page.container.querySelector("[data-villa-card-house-skeleton-badge]"),
    ).not.toBeNull();
    expect(
      page.container.querySelector("[data-villa-card-house-list]")?.className,
    ).toContain("content-start");
    expect(
      page.container.querySelector("[data-villa-card-house-list]")?.className,
    ).toContain("auto-rows-max");

    await page.unmount();
  });

  it("shows a centered empty state when no houses match", async () => {
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
    const listPanel = page.container.querySelector(
      "[data-villa-card-house-list]",
    );

    expect(emptyState).not.toBeNull();
    expect(listPanel?.className).toContain("flex");
    expect(listPanel?.className).toContain("items-center");
    expect(listPanel?.className).toContain("justify-center");
    expect(listPanel?.className).toContain("rounded-xl");
    expect(listPanel?.className).toContain("border");
    expect(listPanel?.className).toContain("bg-[var(--site-surface-soft)]");
    expect(emptyState?.className).toContain("items-center");
    expect(emptyState?.querySelector("svg")).not.toBeNull();
    expect(emptyState?.textContent).toContain("ไม่พบบ้านพัก");

    await page.unmount();
  });

  it("shows image picker skeleton while house images load", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const requestUrl = input instanceof Request ? input.url : String(input);

      if (requestUrl === "/api/admin/villa-card-images?houseId=9") {
        return new Promise<Response>(() => undefined);
      }

      return Promise.resolve(
        makeJsonResponse({
          body: { error: `Unhandled ${requestUrl}` },
          status: 500,
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(
      <AdminVillaCardHouseCustomPage houseId="9" />,
    );
    await flushEffects();

    expect(
      page.container.querySelector("[data-villa-card-image-picker-skeleton]"),
    ).not.toBeNull();
    expect(
      page.container.querySelector("[data-villa-card-image-grid-skeleton]"),
    ).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/villa-card-images?houseId=9",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
      }),
    );
    expect(
      fetchMock.mock.calls.some(([url]) => String(url) === "/api/villas/9/images"),
    ).toBe(false);
    expect(page.container.textContent).not.toContain("กำลังโหลดรูป");

    await page.unmount();
  });

  it("uploads a custom cover image without saving gallery selections", async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURLMock = vi.fn(() => "blob:cover-preview");
    const revokeObjectURLMock = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURLMock,
    });
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = input instanceof Request ? input.url : String(input);
      const requestMethod =
        input instanceof Request ? input.method : init?.method ?? "GET";

      if (
        requestUrl === "/api/admin/villa-card-images?houseId=9" &&
        requestMethod === "GET"
      ) {
        return Promise.resolve(
          makeJsonResponse({
            body: {
              configs: [],
              houses: [
                {
                  coverImage: "https://images.example.com/old-cover.jpg",
                  id: "9",
                  title: "House 9",
                  zoneLabel: "Pattaya",
                },
              ],
              images: [
                {
                  id: 10,
                  imageName: "pool.jpg",
                  imageUrl: "https://images.example.com/pool.jpg",
                  zone: "outside",
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
          }),
        );
      }

      if (
        requestUrl === "/api/admin/villa-card-images" &&
        requestMethod === "PUT"
      ) {
        return Promise.resolve(
          makeJsonResponse({
            body: {
              config: {
                coverImage: {
                  alt: "House 9",
                  path: "villa-cover/9/custom.webp",
                  url: "https://assets.example.com/villa-cover/9/custom.webp",
                },
                houseId: "9",
                id: "config-1",
                imageIds: [],
                isActive: true,
                pageKey: "default",
              },
            },
          }),
        );
      }

      return Promise.resolve(
        makeJsonResponse({
          body: { error: `Unhandled ${requestMethod} ${requestUrl}` },
          status: 500,
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    let page:
      | Awaited<ReturnType<typeof mountAdminPage>>
      | null = null;

    try {
      page = await mountAdminPage(
        <AdminVillaCardHouseCustomPage houseId="9" />,
      );
      await flushEffects();

      const coverInput = page.container.querySelector(
        "[data-villa-cover-input]",
      ) as HTMLInputElement;
      const coverFile = new File(["cover"], "custom-cover.webp", {
        type: "image/webp",
      });

      act(() => {
        Object.defineProperty(coverInput, "files", {
          configurable: true,
          value: [coverFile],
        });
        coverInput.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await flushEffects();
      await flushEffects();

      expect(createObjectURLMock).toHaveBeenCalledWith(coverFile);
      expect(
        page.container.querySelector("[data-villa-cover-save]"),
      ).toBeNull();

      const coverSaveCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          url === "/api/admin/villa-card-images" &&
          (init as RequestInit | undefined)?.method === "PUT",
      );
      const body = (coverSaveCall?.[1] as RequestInit).body as FormData;

      expect(body).toBeInstanceOf(FormData);
      expect(body.get("houseId")).toBe("9");
      expect(body.get("coverImageAlt")).toBe("House 9");
      expect(body.get("coverImage")).toBe(coverFile);
      expect(
        (coverSaveCall?.[1] as RequestInit).headers,
      ).toEqual({ Authorization: "Bearer admin-token" });
      expect(
        page.container.querySelector("[data-villa-cover-current]"),
      ).not.toBeNull();
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            url === "/api/admin/villa-card-images" &&
            typeof (init as RequestInit | undefined)?.body === "string",
        ),
      ).toBe(false);
    } finally {
      await page?.unmount();

      if (originalCreateObjectURL) {
        Object.defineProperty(URL, "createObjectURL", {
          configurable: true,
          value: originalCreateObjectURL,
        });
      } else {
        Reflect.deleteProperty(URL, "createObjectURL");
      }

      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, "revokeObjectURL", {
          configurable: true,
          value: originalRevokeObjectURL,
        });
      } else {
        Reflect.deleteProperty(URL, "revokeObjectURL");
      }
    }
  });

  it("deletes a saved cover image through a dialog and falls back to the original cover", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = input instanceof Request ? input.url : String(input);
      const requestMethod =
        input instanceof Request ? input.method : init?.method ?? "GET";

      if (
        requestUrl === "/api/admin/villa-card-images?houseId=9" &&
        requestMethod === "GET"
      ) {
        return Promise.resolve(
          makeJsonResponse({
            body: {
              configs: [
                {
                  coverImage: {
                    alt: "House 9",
                    path: "villa-cover/9/custom.webp",
                    url: "https://assets.example.com/villa-cover/9/custom.webp",
                  },
                  houseId: "9",
                  id: "config-1",
                  imageIds: [],
                  isActive: true,
                  pageKey: "default",
                },
              ],
              houses: [
                {
                  coverImage: "https://images.example.com/old-cover.jpg",
                  id: "9",
                  title: "House 9",
                  zoneLabel: "Pattaya",
                },
              ],
              images: [],
              pagination: {
                hasMore: false,
                page: 1,
                pageCount: 1,
                pageSize: 1,
                search: "",
                total: 1,
              },
            },
          }),
        );
      }

      if (
        requestUrl === "/api/admin/villa-card-images?houseId=9" &&
        requestMethod === "DELETE"
      ) {
        return Promise.resolve(
          makeJsonResponse({
            body: {
              config: {
                coverImage: null,
                houseId: "9",
                id: "config-1",
                imageIds: [],
                isActive: true,
                pageKey: "default",
              },
            },
          }),
        );
      }

      return Promise.resolve(
        makeJsonResponse({
          body: { error: `Unhandled ${requestMethod} ${requestUrl}` },
          status: 500,
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(
      <AdminVillaCardHouseCustomPage houseId="9" />,
    );
    await flushEffects();

    expect(page.container.querySelector("[data-villa-cover-current]")).not.toBeNull();
    const coverInput = page.container.querySelector(
      "[data-villa-cover-input]",
    ) as HTMLInputElement;
    const coverUploadLabel = coverInput.closest("label");
    const coverDeleteButton = page.container.querySelector(
      "[data-villa-cover-delete]",
    ) as HTMLButtonElement;

    expect(coverUploadLabel?.textContent).toContain("อัพโหลดรูปปก");
    expect(coverUploadLabel?.className).toContain("h-9");
    expect(coverDeleteButton.className).toContain("h-9");
    expect(coverUploadLabel?.parentElement).toBe(coverDeleteButton.parentElement);

    await click(
      coverDeleteButton,
    );

    expect(
      page.container.querySelector("[data-villa-cover-delete-dialog]"),
    ).not.toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/admin/villa-card-images?houseId=9",
      expect.objectContaining({ method: "DELETE" }),
    );

    await click(
      page.container.querySelector(
        "[data-villa-cover-delete-confirm]",
      ) as HTMLButtonElement,
    );
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/villa-card-images?houseId=9",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
        method: "DELETE",
      }),
    );
    expect(
      page.container.querySelector("[data-villa-cover-delete-dialog]"),
    ).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(page.container.querySelector("[data-villa-cover-current]")).toBeNull();

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
          images: [
            {
              id: 10,
              imageName: "cover-with-a-very-long-file-name-that-should-truncate.jpg",
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
      <AdminVillaCardHouseCustomPage
        houseId="9"
        returnPage="2"
        returnSearch="9"
      />,
    );
    await flushEffects();
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/villa-card-images?houseId=9",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
      }),
    );
    expect(
      fetchMock.mock.calls.filter(
        ([url, init]) =>
          url === "/api/admin/villa-card-images?houseId=9" &&
          ((init as RequestInit | undefined)?.method ?? "GET") === "GET",
      ),
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.some(([url]) => String(url) === "/api/villas/9/images"),
    ).toBe(false);
    expect(
      page.container.querySelector("[data-villa-card-house-id-input]"),
    ).toBeNull();
    expect(
      page.container
        .querySelector("[data-villa-card-back-link]")
        ?.getAttribute("href"),
    ).toBe("/admin/card-images/houses?page=2&search=9");
    expect(
      Array.from(
        page.container.querySelectorAll("[data-villa-card-zone-option]"),
        (item) => item.getAttribute("data-villa-card-zone-option"),
      ),
    ).toEqual(["outside", "inside", "__all__"]);
    expect(
      page.container.querySelector('[data-villa-card-image-option="30"]'),
    ).toBeNull();

    const coverButton = page.container.querySelector(
      '[data-villa-card-image-option="10"]',
    ) as HTMLButtonElement | null;

    expect(coverButton).not.toBeNull();
    expect(
      coverButton
        ?.querySelector("[data-villa-card-image-name]")
        ?.className,
    ).toContain("truncate");
    expect(
      coverButton?.querySelector("[data-villa-card-image-name]")?.textContent,
    ).toContain("cover-with-a-very-long-file-name");
    expect(
      coverButton?.querySelector("[data-villa-card-image-zone]")?.textContent,
    ).toContain("ภายนอกบ้าน");
    expect(
      coverButton?.querySelector("[data-villa-card-image-zone]")?.textContent,
    ).not.toContain("outside");
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
      page.container.querySelector("[data-villa-card-sort-images]") as HTMLButtonElement,
    );

    const confirmDialog = page.container.querySelector(
      "[data-villa-card-confirm-dialog]",
    );
    expect(confirmDialog).not.toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    expect(
      page.container.querySelector("[data-villa-card-confirm-cancel]"),
    ).not.toBeNull();
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
        "[data-villa-card-confirm-cancel]",
      ) as HTMLButtonElement,
    );
    expect(
      page.container.querySelector("[data-villa-card-confirm-dialog]"),
    ).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/admin/villa-card-images",
      expect.objectContaining({ method: "PUT" }),
    );

    await click(
      page.container.querySelector("[data-villa-card-sort-images]") as HTMLButtonElement,
    );
    expect(document.body.style.overflow).toBe("hidden");
    expect(
      page.container
        .querySelector("[data-villa-card-confirm-order]")
        ?.getAttribute("data-villa-card-confirm-order"),
    ).toBe("10,20,30");

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

    // Save from the sort dialog.
    await click(
      page.container.querySelector(
        "[data-villa-card-confirm-done]",
      ) as HTMLButtonElement,
    );
    await flushEffects();
    expect(
      page.container.querySelector("[data-villa-card-confirm-dialog]"),
    ).toBeNull();
    expect(document.body.style.overflow).toBe("");

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
