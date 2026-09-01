/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  click,
  flushEffects,
  makeFetchMock,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { DEFAULT_DETAIL_LAYOUT_V2 } from "@/lib/detail-layout/defaults";
import type { DetailLayoutV2Config } from "@/lib/detail-layout/types";

const mocks = vi.hoisted(() => ({
  readAdminAccessToken: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  router: {
    refresh: vi.fn(),
    replace: vi.fn(),
  },
}));

const savedLayout: DetailLayoutV2Config = {
  ...DEFAULT_DETAIL_LAYOUT_V2,
  mainSplit: {
    ...DEFAULT_DETAIL_LAYOUT_V2.mainSplit,
    ratio: "30/70",
  },
};

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/components/admin/admin-auth", () => ({
  readAdminAccessToken: mocks.readAdminAccessToken,
}));

import { AdminDetailLayoutPage } from "../admin-detail-layout-page";

describe("AdminDetailLayoutPage", () => {
  beforeEach(() => {
    mocks.readAdminAccessToken.mockResolvedValue("admin-token");
    mocks.refresh.mockReset();
    mocks.replace.mockReset();
    mocks.router.refresh = mocks.refresh;
    mocks.router.replace = mocks.replace;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the detail layout and supports local reset interactions", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout },
        url: "/api/admin/detail-layout",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminDetailLayoutPage />);
    const pageText = page.container.textContent ?? "";

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/detail-layout",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
      }),
    );
    expect(pageText).not.toContain("ปิดไว้");
    expect(pageText).not.toContain("บล็อกที่ใช้");
    expect(pageText).not.toContain("ล็อกไว้");
    expect(pageText).not.toContain("ล็อกเต็ม");
    expect(pageText).not.toContain("ส่วนล็อก");

    const resetButton = page.container.querySelector(
      "header button",
    ) as HTMLButtonElement | null;

    expect(resetButton).not.toBeNull();

    await click(resetButton as HTMLButtonElement);

    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          url === "/api/admin/detail-layout" && init?.method !== undefined,
      ),
    ).toBe(false);

    await page.unmount();
  });

  it("places the settings and preview panel under the canvas before the three-column breakpoint", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout },
        url: "/api/admin/detail-layout",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminDetailLayoutPage />);
    const sidePanel = page.container.querySelector(
      '[data-detail-layout-side-panel="true"]',
    );

    expect(sidePanel?.className).toContain("xl:col-start-2");
    expect(sidePanel?.className).toContain("xl:row-start-2");
    expect(sidePanel?.className).toContain("2xl:col-start-3");
    expect(sidePanel?.className).toContain("2xl:row-start-1");

    await page.unmount();
  });

  it("uses a compact sticky header and leaves space for section navigation", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout },
        url: "/api/admin/detail-layout",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminDetailLayoutPage />);
    const pageHeader = page.container.querySelector(
      '[data-detail-layout-page-header="true"]',
    );
    const canvas = page.container.querySelector("#detail-layout-canvas");
    const gallery = page.container.querySelector("#gallery-opening-style");

    expect(pageHeader?.className).toContain("lg:pt-4");
    expect(pageHeader?.className).toContain("lg:pb-3");
    expect(pageHeader?.querySelector("h1")?.className).toContain("text-2xl");
    expect(
      pageHeader?.querySelector("button")?.className,
    ).toContain("h-10");
    expect(canvas?.className).toContain("lg:scroll-mt-40");
    expect(gallery?.className).toContain("lg:scroll-mt-40");

    await page.unmount();
  });

  it("uses sticky settings and a bottom action bar on mobile", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout },
        url: "/api/admin/detail-layout",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminDetailLayoutPage />);
    const pageHeader = page.container.querySelector(
      '[data-detail-layout-page-header="true"]',
    );
    const sectionNavigation = page.container.querySelector(
      '[data-detail-layout-section-navigation="true"]',
    );
    const resetButton = Array.from(page.container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("ค่าเริ่มต้น"),
    );

    expect(pageHeader?.className).toContain("fixed");
    expect(pageHeader?.className).toContain("bottom-0");
    expect(pageHeader?.className).toContain("lg:sticky");
    expect(sectionNavigation?.className).toContain("sticky");
    expect(sectionNavigation?.className).toContain("top-[73px]");
    expect(resetButton?.className).toContain("hidden");
    expect(resetButton?.className).toContain("lg:inline-flex");

    await page.unmount();
  });

  it("places the gallery opening controls below the detail layout canvas", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout },
        url: "/api/admin/detail-layout",
      },
      {
        body: {
          settings: {
            backgroundColor: "#ffffff",
            textColor: "#111111",
            variant: "categorized-grid",
          },
        },
        url: "/api/admin/site-web-styles/gallery",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminDetailLayoutPage />);
    await flushEffects();
    const sidePanel = page.container.querySelector(
      '[data-detail-layout-side-panel="true"]',
    );
    const canvasColumn = page.container.querySelector("main");
    const panels = Array.from(sidePanel?.children ?? []);

    expect(
      panels.map((panel) => panel.querySelector("h2")?.textContent),
    ).toEqual(["พรีวิวย่อ", "ตั้งค่าแถวและบล็อก"]);
    expect(
      canvasColumn?.querySelector(
        ':scope > #gallery-opening-style [data-gallery-style-editor="true"]',
      ),
    ).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/site-web-styles/gallery",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
      }),
    );

    await page.unmount();
  });

  it("uses the Settings sidebar pattern for detail-page section navigation", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout },
        url: "/api/admin/detail-layout",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminDetailLayoutPage />);
    const miniSidebar = page.container.querySelector(
      '[data-detail-layout-section-navigation="true"]',
    );

    expect(miniSidebar?.textContent).toContain("การตั้งค่าหน้า Details");
    expect(miniSidebar?.textContent).toContain("เลือกส่วนที่ต้องการจัดการ");
    expect(miniSidebar?.textContent).toContain("ผังหน้า Details");
    expect(miniSidebar?.textContent).toContain("วิธีเปิดดูรูปบ้าน");
    expect(miniSidebar?.className).toContain("sticky");
    expect(
      miniSidebar?.querySelector('[aria-controls="detail-layout-section-navigation"]'),
    ).not.toBeNull();
    expect(
      miniSidebar?.querySelector('a[href="#detail-layout-canvas"]'),
    ).not.toBeNull();
    expect(
      miniSidebar?.querySelector('a[href="#gallery-opening-style"]'),
    ).not.toBeNull();

    await page.unmount();
  });

  it("keeps detail settings above the block library until the library has scrolled away on desktop", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout },
        url: "/api/admin/detail-layout",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminDetailLayoutPage />);
    const blockLibrary = page.container.querySelector(
      '[data-detail-layout-block-library="true"]',
    );
    const sectionNavigation = page.container.querySelector(
      '[data-detail-layout-section-navigation="true"]',
    );

    expect(sectionNavigation?.className).toContain("xl:order-1");
    expect(blockLibrary?.className).toContain("xl:order-2");
    expect(sectionNavigation?.className).toContain("sticky");
    expect(sectionNavigation?.className).toContain("lg:relative");
    expect(
      sectionNavigation?.getAttribute(
        "data-detail-layout-section-navigation-pinned",
      ),
    ).toBe("false");

    await page.unmount();
  });

  it("pins detail settings only after the block library passes the page header", async () => {
    vi.stubGlobal("innerWidth", 1280);
    let observeLibrary: (entries: IntersectionObserverEntry[]) => void = () => {
      throw new Error("Intersection observer callback was not registered");
    };

    class IntersectionObserverMock {
      constructor(callback: IntersectionObserverCallback) {
        observeLibrary = (entries) =>
          callback(entries, this as unknown as IntersectionObserver);
      }

      disconnect() {}

      observe() {}

      takeRecords() {
        return [];
      }

      unobserve() {}
    }

    const boundsSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        return this.dataset.detailLayoutSidebarRail === "true"
          ? new DOMRect(84, 0, 300, 800)
          : new DOMRect();
      });
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout },
        url: "/api/admin/detail-layout",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminDetailLayoutPage />);
    await flushEffects();
    observeLibrary([
      {
        boundingClientRect: new DOMRect(0, -400, 300, 300),
        isIntersecting: false,
      } as IntersectionObserverEntry,
    ]);
    await flushEffects();
    const sectionNavigation = page.container.querySelector(
      '[data-detail-layout-section-navigation="true"]',
    );

    expect(
      sectionNavigation?.getAttribute(
        "data-detail-layout-section-navigation-pinned",
      ),
    ).toBe("true");
    expect(sectionNavigation?.className).toContain("xl:fixed");
    expect((sectionNavigation as HTMLElement | null)?.style.left).toBe("84px");
    expect((sectionNavigation as HTMLElement | null)?.style.width).toBe("300px");

    boundsSpy.mockRestore();
    await page.unmount();
  });

  it("saves gallery opening settings through the shared detail-layout save action", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout },
        url: "/api/admin/detail-layout",
      },
      {
        body: {
          settings: {
            backgroundColor: "#ffffff",
            textColor: "#111111",
            variant: "categorized-grid",
          },
        },
        url: "/api/admin/site-web-styles/gallery",
      },
      {
        body: {
          settings: {
            backgroundColor: "#ffffff",
            textColor: "#111111",
            variant: "lightbox",
          },
        },
        method: "PATCH",
        url: "/api/admin/site-web-styles/gallery",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminDetailLayoutPage />);
    await flushEffects();
    await flushEffects();
    const lightboxOption = page.container.querySelector<HTMLInputElement>(
      'input[name="galleryVariant"][value="lightbox"]',
    );
    const saveButton = page.container.querySelector<HTMLButtonElement>(
      "[data-detail-layout-save]",
    );

    expect(lightboxOption).not.toBeNull();
    expect(saveButton).not.toBeNull();
    expect(
      page.container.querySelector("[data-gallery-style-save]"),
    ).toBeNull();

    await click(lightboxOption as HTMLInputElement);
    await click(saveButton as HTMLButtonElement);
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/site-web-styles/gallery",
      expect.objectContaining({
        body: JSON.stringify({
          backgroundColor: "#ffffff",
          textColor: "#111111",
          variant: "lightbox",
        }),
        headers: expect.any(Headers),
        method: "PATCH",
      }),
    );

    await page.unmount();
  });

  it("saves a locally reset layout without refetching the page data", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout },
        url: "/api/admin/detail-layout",
      },
      {
        body: { layout: DEFAULT_DETAIL_LAYOUT_V2 },
        method: "PUT",
        url: "/api/admin/detail-layout",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminDetailLayoutPage />);
    const buttons = Array.from(page.container.querySelectorAll("header button"));
    const resetButton = buttons[0] as HTMLButtonElement | undefined;

    expect(resetButton).not.toBeUndefined();

    await click(resetButton as HTMLButtonElement);
    await flushEffects();
    const callsBeforeSave = fetchMock.mock.calls.length;

    const saveButton = Array.from(page.container.querySelectorAll("header button"))[1];

    expect(saveButton).not.toBeUndefined();

    await click(saveButton as HTMLButtonElement);
    await flushEffects();

    expect(fetchMock.mock.calls.length - callsBeforeSave).toBe(1);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/detail-layout",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json",
        },
        method: "PUT",
      }),
    );
    expect(mocks.refresh).not.toHaveBeenCalled();

    await page.unmount();
  });

  it("shows save validation at the invalid row and scrolls to that row", async () => {
    const previousScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout },
        url: "/api/admin/detail-layout",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminDetailLayoutPage />);
    const addNarrowRowButton = Array.from(
      page.container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("เพิ่มแถว 30"));

    expect(addNarrowRowButton).not.toBeUndefined();

    await click(addNarrowRowButton as HTMLButtonElement);
    await flushEffects();

    const saveButton = Array.from(page.container.querySelectorAll("header button"))[1];

    expect(saveButton).not.toBeUndefined();

    await click(saveButton as HTMLButtonElement);
    await flushEffects();

    const fieldError = page.container.querySelector(
      '[data-detail-layout-error="true"]',
    );

    expect(fieldError?.textContent).toContain("ฝั่ง 30 ลำดับที่ 4 ต้องมี block");
    expect(fieldError?.closest("article")?.textContent).toContain("แถว 30 ที่ 4");
    expect(page.container.textContent).not.toContain(
      "แก้รายการเหล่านี้ก่อนบันทึก:",
    );
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "PUT"),
    ).toBe(false);

    await page.unmount();

    if (previousScrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: previousScrollIntoView,
      });
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
  });
});
