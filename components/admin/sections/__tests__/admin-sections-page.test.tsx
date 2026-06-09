/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  changeInput,
  click,
  flushEffects,
  makeFetchMock,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";

const mocks = vi.hoisted(() => ({
  readAdminAccessToken: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  router: {
    refresh: vi.fn(),
    replace: vi.fn(),
  },
}));

const savedSection = {
  ctaEnabled: false,
  ctaHref: "",
  ctaLabel: "",
  description: "โซนยอดนิยม",
  displayOrder: 0,
  fallbackMode: "fill_from_all",
  isActive: true,
  items: [],
  limitCount: 6,
  mode: "slice",
  sliceOffset: 0,
  slug: "featured",
  title: "บ้านแนะนำ",
};

const manualSection = {
  ...savedSection,
  items: [
    { houseId: "101", isActive: true, position: 0 },
    { houseId: "102", isActive: true, position: 1 },
  ],
  mode: "manual",
};

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/components/admin/admin-auth", () => ({
  readAdminAccessToken: mocks.readAdminAccessToken,
}));

import { AdminSectionsPage } from "../admin-sections-page";

describe("AdminSectionsPage", () => {
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

  it("saves section changes without reloading the route", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { sections: [savedSection] },
        url: "/api/admin/home-sections",
      },
      {
        body: { sections: [{ ...savedSection, limitCount: 7 }] },
        method: "PUT",
        url: "/api/admin/home-sections",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSectionsPage />);
    const limitCountInput = page.container.querySelector(
      "input[type='number']",
    ) as HTMLInputElement | null;

    expect(limitCountInput).not.toBeNull();

    await changeInput(limitCountInput as HTMLInputElement, "7");
    const callsBeforeSave = fetchMock.mock.calls.length;

    const saveButton = Array.from(page.container.querySelectorAll("button")).find(
      (button) => {
        return button.textContent?.includes("บันทึกหน้าแรก");
      },
    );

    expect(saveButton).not.toBeNull();

    await click(saveButton as HTMLButtonElement);
    await flushEffects();

    expect(fetchMock.mock.calls.length - callsBeforeSave).toBe(1);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/home-sections",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json",
        },
        method: "PUT",
      }),
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect((page.container.querySelector("input[type='number']") as HTMLInputElement).value).toBe(
      "7",
    );

    await page.unmount();
  });

  it("keeps the current section selected after saving", async () => {
    const firstSection = {
      ...savedSection,
      slug: "featured",
      title: "Featured",
    };
    const secondSection = {
      ...savedSection,
      displayOrder: 1,
      limitCount: 4,
      slug: "family",
      title: "Family",
    };
    const fetchMock = makeFetchMock([
      {
        body: { sections: [firstSection, secondSection] },
        url: "/api/admin/home-sections",
      },
      {
        body: {
          sections: [firstSection, { ...secondSection, limitCount: 8 }],
        },
        method: "PUT",
        url: "/api/admin/home-sections",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSectionsPage />);
    const sectionButtons = page.container.querySelectorAll("aside button");

    expect(sectionButtons).toHaveLength(2);

    await click(sectionButtons[1] as HTMLButtonElement);

    const limitCountInput = page.container.querySelector(
      "input[type='number']",
    ) as HTMLInputElement | null;

    expect(limitCountInput).not.toBeNull();

    await changeInput(limitCountInput as HTMLInputElement, "8");

    const headerButtons = page.container.querySelectorAll(
      "#adminSectionsPageHeader button",
    );
    const saveButton = headerButtons[1] ?? null;

    expect(saveButton).not.toBeNull();

    await click(saveButton as HTMLButtonElement);
    await flushEffects();

    const nextSectionButtons = page.container.querySelectorAll("aside button");

    expect(nextSectionButtons[1]?.getAttribute("aria-pressed")).toBe("true");

    await page.unmount();
  });

  it("keeps the add section header action visible below large screens", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { sections: [savedSection] },
        url: "/api/admin/home-sections",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSectionsPage />);
    const headerButtons = page.container.querySelectorAll(
      "#adminSectionsPageHeader button",
    );
    const addSectionButton = headerButtons[0] ?? null;

    expect(addSectionButton).not.toBeNull();
    expect(addSectionButton?.className).not.toContain("hidden");

    await page.unmount();
  });

  it("does not auto-preview manual house IDs while editing", async () => {
    vi.useFakeTimers();
    const fetchMock = makeFetchMock([
      {
        body: { sections: [manualSection] },
        url: "/api/admin/home-sections",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSectionsPage />);

    await vi.advanceTimersByTimeAsync(800);

    expect(
      fetchMock.mock.calls.filter(([url]) => {
        return url === "/api/admin/home-sections/preview";
      }),
    ).toHaveLength(0);

    await page.unmount();
    vi.useRealTimers();
  });
});
