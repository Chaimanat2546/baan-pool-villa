/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  changeInput,
  click,
  flushEffects,
  makeFetchMock,
  makeJsonResponse,
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
  signOut: vi.fn(),
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

const secondSection = {
  ...savedSection,
  description: "เหมาะสำหรับครอบครัว",
  displayOrder: 1,
  slug: "family",
  title: "บ้านสำหรับครอบครัว",
};

const savedLayout = [
  { enabled: true, key: "featured", kind: "rail" },
  { enabled: true, key: "why_choose", kind: "fixed" },
  { enabled: true, key: "family", kind: "rail" },
  { enabled: true, key: "tiktok", kind: "fixed" },
  { enabled: true, key: "customer_reviews", kind: "fixed" },
  { enabled: true, key: "articles", kind: "fixed" },
  { enabled: true, key: "faq", kind: "fixed" },
  { enabled: true, key: "contact", kind: "fixed" },
] as const;

const fixedOnlyLayout = savedLayout.filter((item) => item.kind === "fixed");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function findButton(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  );
}

async function changeTextArea(
  element: HTMLTextAreaElement,
  value: string,
) {
  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flushEffects();
}

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
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

import { AdminSectionsPage } from "../admin-sections-page";

describe("AdminSectionsPage", () => {
  beforeEach(() => {
    mocks.readAdminAccessToken.mockResolvedValue("admin-token");
    mocks.refresh.mockReset();
    mocks.replace.mockReset();
    mocks.signOut.mockReset();
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.router.refresh = mocks.refresh;
    mocks.router.replace = mocks.replace;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("signs out before redirecting when the session is not an active admin", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock([
        {
          body: {
            error:
              "Signed-in user is not listed as an active home config admin.",
          },
          status: 403,
          url: "/api/admin/home-sections",
        },
      ]),
    );

    const page = await mountAdminPage(<AdminSectionsPage />);
    await flushEffects();

    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.replace).toHaveBeenCalledWith(
      "/admin/login?error=admin-access",
    );

    await page.unmount();
  });

  it("saves section changes without reloading the route", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout, sections: [savedSection, secondSection] },
        url: "/api/admin/home-sections",
      },
      {
        body: {
          layout: savedLayout,
          sections: [
            { ...savedSection, limitCount: 7 },
            secondSection,
          ],
          warnings: ["บันทึกหน้าแรกแล้ว แต่การรีเฟรชแคชไม่สำเร็จ"],
        },
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
        return button.textContent?.includes("บันทึก");
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
    expect(page.container.textContent).toContain(
      "บันทึกหน้าแรกแล้ว แต่การรีเฟรชแคชไม่สำเร็จ",
    );
    expect(saveButton?.hasAttribute("disabled")).toBe(true);

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
        body: { layout: savedLayout, sections: [firstSection, secondSection] },
        url: "/api/admin/home-sections",
      },
      {
        body: {
          layout: savedLayout,
          sections: [firstSection, { ...secondSection, limitCount: 8 }],
        },
        method: "PUT",
        url: "/api/admin/home-sections",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSectionsPage />);
    const sectionButtons = page.container.querySelectorAll(
      "[data-layout-select='rail']",
    );

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

    const nextSectionButtons = page.container.querySelectorAll(
      "[data-layout-select='rail']",
    );

    expect(nextSectionButtons[1]?.getAttribute("aria-pressed")).toBe("true");

    await page.unmount();
  });

  it("keeps the add section header action visible below large screens", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout, sections: [savedSection, secondSection] },
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

  it("loads a legacy section with an empty description into the editor for repair", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock([
        {
          body: {
            layout: savedLayout,
            sections: [
              { ...savedSection, description: "" },
              secondSection,
            ],
          },
          url: "/api/admin/home-sections",
        },
      ]),
    );

    const page = await mountAdminPage(<AdminSectionsPage />);
    await flushEffects();
    const descriptionInput = page.container.querySelector("textarea");

    expect(descriptionInput).not.toBeNull();
    expect((descriptionInput as HTMLTextAreaElement).value).toBe("");
    expect(
      page.container.querySelectorAll("[data-layout-select='rail']"),
    ).toHaveLength(2);

    await page.unmount();
  });

  it("shows validation errors beside the first invalid field and scrolls there", async () => {
    const scrolledElements: Element[] = [];
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value(this: Element) {
        scrolledElements.push(this);
      },
    });
    const fetchMock = makeFetchMock([
      {
        body: {
          sections: [
            { ...savedSection, slug: "first", title: "First" },
            {
              ...savedSection,
              displayOrder: 1,
              slug: "second",
              title: "Second",
            },
          ],
          layout: [
            { enabled: true, key: "first", kind: "rail" },
            { enabled: true, key: "why_choose", kind: "fixed" },
            { enabled: true, key: "second", kind: "rail" },
            ...savedLayout.slice(3),
          ],
        },
        url: "/api/admin/home-sections",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSectionsPage />);
    const railButtons = page.container.querySelectorAll(
      "[data-layout-select='rail']",
    );
    await click(railButtons[1] as HTMLButtonElement);
    await changeInput(
      page.container.querySelector(
        "input[placeholder='เช่น บ้านพักแนะนำ']",
      ) as HTMLInputElement,
      "",
    );
    await click(
      page.container.querySelectorAll("[data-layout-select='rail']")[0] as
        HTMLButtonElement,
    );
    const titleInput = page.container.querySelector(
      "input[placeholder='เช่น บ้านพักแนะนำ']",
    ) as HTMLInputElement | null;

    expect(titleInput).not.toBeNull();

    await changeInput(titleInput as HTMLInputElement, "First updated");

    const saveButton = Array.from(page.container.querySelectorAll("button")).find(
      (button) => {
        return button.textContent?.includes("บันทึก");
      },
    );

    expect(saveButton).not.toBeNull();

    await click(saveButton as HTMLButtonElement);
    await flushEffects();

    const selectedTitleInput = page.container.querySelector(
      "input[placeholder='เช่น บ้านพักแนะนำ']",
    ) as HTMLInputElement | null;
    const titleError = page.container.querySelector(
      "[data-admin-section-field-error='title']",
    );

    expect(selectedTitleInput?.value).toBe("");
    expect(titleError?.textContent).toContain("ต้องมีชื่อชุดบ้านพัก");
    expect(scrolledElements[0]?.getAttribute("data-admin-section-error-target")).toBe(
      "title",
    );

    await page.unmount();
  });

  it("does not auto-preview manual house IDs while editing", async () => {
    vi.useFakeTimers();
    const fetchMock = makeFetchMock([
      {
        body: {
          layout: savedLayout.filter(
            (item) => item.kind === "fixed" || item.key === "featured",
          ),
          sections: [manualSection],
        },
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

  it("saves a confirmed Manual house order", async () => {
    const orderedManualSection = {
      ...manualSection,
      items: [
        { houseId: "702", isActive: true, position: 0 },
        { houseId: "105", isActive: true, position: 1 },
      ],
    };
    const reorderedManualSection = {
      ...orderedManualSection,
      items: [
        { houseId: "105", isActive: true, position: 0 },
        { houseId: "702", isActive: true, position: 1 },
      ],
    };
    const manualLayout = savedLayout.filter(
      (item) => item.kind === "fixed" || item.key === "featured",
    );
    const fetchMock = makeFetchMock([
      {
        body: {
          layout: manualLayout,
          sections: [orderedManualSection],
        },
        url: "/api/admin/home-sections",
      },
      {
        body: {
          invalidIds: [],
          missingIds: [],
          validIds: ["105", "702"],
        },
        method: "POST",
        url: "/api/admin/home-sections/preview",
      },
      {
        body: {
          layout: manualLayout,
          sections: [reorderedManualSection],
        },
        method: "PUT",
        url: "/api/admin/home-sections",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSectionsPage />);
    try {
      await flushEffects();

      const orderButton = findButton(page.container, "เรียงบ้าน");
      expect(orderButton).not.toBeUndefined();

      await click(orderButton as HTMLButtonElement);
      const moveRightButton = page.container.querySelector(
        "button[aria-label='เลื่อนไปขวา บ้าน 702']",
      ) as HTMLButtonElement | null;
      expect(moveRightButton).not.toBeNull();

      await click(moveRightButton as HTMLButtonElement);
      await click(findButton(page.container, "เสร็จสิ้น") as HTMLButtonElement);
      await click(findButton(page.container, "บันทึก") as HTMLButtonElement);

      const putCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          url === "/api/admin/home-sections" && init?.method === "PUT",
      );
      const putBody = JSON.parse(String(putCall?.[1]?.body));

      expect(putBody.sections[0].items).toEqual([
        { houseId: "105", isActive: true },
        { houseId: "702", isActive: true },
      ]);
    } finally {
      await page.unmount();
    }
  });

  it("closes Manual ordering when its active rail changes without leaking on return", async () => {
    const secondManualSection = {
      ...manualSection,
      displayOrder: 1,
      items: [
        { houseId: "201", isActive: true, position: 0 },
        { houseId: "202", isActive: true, position: 1 },
      ],
      slug: "family",
      title: "บ้านสำหรับครอบครัว",
    };
    vi.stubGlobal(
      "fetch",
      makeFetchMock([
        {
          body: {
            layout: savedLayout,
            sections: [manualSection, secondManualSection],
          },
          url: "/api/admin/home-sections",
        },
      ]),
    );

    const page = await mountAdminPage(<AdminSectionsPage />);
    try {
      await click(findButton(page.container, "เรียงบ้าน") as HTMLButtonElement);
      expect(page.container.querySelector("[role='dialog']")).not.toBeNull();

      const railButtons = page.container.querySelectorAll(
        "[data-layout-select='rail']",
      );
      await click(railButtons[1] as HTMLButtonElement);
      expect(page.container.querySelector("[role='dialog']")).toBeNull();

      await click(railButtons[0] as HTMLButtonElement);
      expect(page.container.querySelector("[role='dialog']")).toBeNull();
    } finally {
      await page.unmount();
    }
  });

  it.each(["near_sea", "slice"] as const)(
    "does not expose ordering controls for %s rails",
    async (mode) => {
    const automaticSection = {
      ...savedSection,
      mode,
    };
    vi.stubGlobal(
      "fetch",
      makeFetchMock([
        {
          body: {
            layout: savedLayout.filter(
              (item) => item.kind === "fixed" || item.key === "featured",
            ),
            sections: [automaticSection],
          },
          url: "/api/admin/home-sections",
        },
      ]),
    );

    const page = await mountAdminPage(<AdminSectionsPage />);

    expect(findButton(page.container, "เรียงบ้าน")).toBeUndefined();

    await page.unmount();
    },
  );

  it("renders Hero and mixed layout rows without prototype UI", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock([
        {
          body: {
            layout: savedLayout,
            sections: [savedSection, secondSection],
          },
          url: "/api/admin/home-sections",
        },
      ]),
    );

    const page = await mountAdminPage(<AdminSectionsPage />);
    await flushEffects();
    const heroRow = page.container.querySelector("[data-home-hero-row]");
    const fixedRow = page.container.querySelector(
      "[data-layout-identity='fixed:why_choose']",
    );
    const railRow = page.container.querySelector(
      "[data-layout-identity='rail:featured']",
    );

    expect(heroRow?.textContent).toContain("อยู่บนสุดเสมอ");
    expect(heroRow?.querySelector("input[type='checkbox']")).toBeNull();
    expect(fixedRow?.textContent).toContain("ส่วนของระบบ");
    expect(fixedRow?.textContent).not.toContain("ลบ");
    expect(railRow?.textContent).toContain("ชุดบ้านพัก");
    expect(page.container.textContent).not.toContain("Prototype");
    expect(page.container.textContent).not.toContain("สรุปก่อนบันทึก");
    expect(page.container.textContent).not.toContain(
      "ตัวอย่างจำลองบนหน้าแรก",
    );

    await click(findButton(page.container, "เพิ่มชุดบ้านพัก") as HTMLButtonElement);

    const newRail = Array.from(
      page.container.querySelectorAll("[data-layout-identity^='rail:']"),
    ).find((row) => row.textContent?.includes("ใหม่"));
    expect(newRail?.textContent).toContain("ชุดบ้านพัก");

    await page.unmount();
  });

  it("moves a fixed row and toggles contact in the saved layout", async () => {
    const expectedLayout = [
      savedLayout[0],
      savedLayout[2],
      savedLayout[1],
      ...savedLayout.slice(3, -1),
      { ...savedLayout.at(-1)!, enabled: false },
    ];
    const fetchMock = makeFetchMock([
      {
        body: {
          layout: savedLayout,
          sections: [savedSection, secondSection],
        },
        url: "/api/admin/home-sections",
      },
      {
        body: {
          layout: expectedLayout,
          sections: [savedSection, secondSection],
        },
        method: "PUT",
        url: "/api/admin/home-sections",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSectionsPage />);
    const moveWhyChooseDown = page.container.querySelector(
      "button[aria-label='เลื่อนทำไมต้องเลือกเราลง']",
    );
    const contactCheckbox = page.container.querySelector(
      "input[aria-label='แสดงติดต่อเราบนหน้าแรก']",
    );

    expect(moveWhyChooseDown).not.toBeNull();
    expect(contactCheckbox).not.toBeNull();

    await click(moveWhyChooseDown as HTMLButtonElement);
    await click(contactCheckbox as HTMLInputElement);
    await click(findButton(page.container, "บันทึก") as HTMLButtonElement);

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === "/api/admin/home-sections" && init?.method === "PUT",
    );
    const body = JSON.parse(String(putCall?.[1]?.body));

    expect(Object.keys(body).sort()).toEqual(["layout", "sections"]);
    expect(body.layout).toEqual(expectedLayout);
    expect(body.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isActive: true, slug: "featured" }),
        expect.objectContaining({ isActive: true, slug: "family" }),
      ]),
    );

    await page.unmount();
  });

  it("deletes a rail from both saved arrays after confirmation", async () => {
    const remainingLayout = savedLayout.filter(
      (item) => !(item.kind === "rail" && item.key === "family"),
    );
    const fetchMock = makeFetchMock([
      {
        body: {
          layout: savedLayout,
          sections: [savedSection, secondSection],
        },
        url: "/api/admin/home-sections",
      },
      {
        body: { layout: remainingLayout, sections: [savedSection] },
        method: "PUT",
        url: "/api/admin/home-sections",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSectionsPage />);
    const familyButton = page.container.querySelector(
      "[data-layout-identity='rail:family'] [data-layout-select='rail']",
    );

    await click(familyButton as HTMLButtonElement);
    await click(findButton(page.container, "ลบชุดนี้") as HTMLButtonElement);
    await click(findButton(page.container, "ยืนยันลบ") as HTMLButtonElement);
    await click(findButton(page.container, "บันทึก") as HTMLButtonElement);

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === "/api/admin/home-sections" && init?.method === "PUT",
    );
    const body = JSON.parse(String(putCall?.[1]?.body));

    expect(body.layout).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "family" })]),
    );
    expect(body.sections).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ slug: "family" })]),
    );

    await page.unmount();
  });

  it("shows ownership guidance and links for fixed sections", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock([
        {
          body: {
            layout: savedLayout,
            sections: [savedSection, secondSection],
          },
          url: "/api/admin/home-sections",
        },
      ]),
    );

    const page = await mountAdminPage(<AdminSectionsPage />);
    const tiktokButton = page.container.querySelector(
      "[data-layout-identity='fixed:tiktok'] [data-layout-select='fixed']",
    );

    await click(tiktokButton as HTMLButtonElement);

    expect(
      page.container.querySelector("a[href='/admin/tiktok']"),
    ).not.toBeNull();
    expect(page.container.textContent).toContain("ส่วนของระบบ");

    await page.unmount();
  });

  it("preserves edits made during manual validation and the PUT request", async () => {
    const previewResponse = deferred<Response>();
    const putResponse = deferred<Response>();
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (url === "/api/admin/home-sections" && method === "GET") {
          return Promise.resolve(
            makeJsonResponse({
              body: {
                layout: savedLayout.filter(
                  (item) =>
                    item.kind === "fixed" || item.key === "featured",
                ),
                sections: [manualSection],
              },
            }),
          );
        }
        if (
          url === "/api/admin/home-sections/preview" &&
          method === "POST"
        ) {
          return previewResponse.promise;
        }
        if (url === "/api/admin/home-sections" && method === "PUT") {
          return putResponse.promise;
        }
        throw new Error(`Unhandled ${method} ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSectionsPage />);
    const titleInput = page.container.querySelector(
      "input[placeholder='เช่น บ้านพักแนะนำ']",
    ) as HTMLInputElement;
    await changeInput(titleInput, "ค่าที่ส่งบันทึก");
    await click(findButton(page.container, "บันทึก") as HTMLButtonElement);

    await changeInput(titleInput, "แก้ระหว่างตรวจเลขบ้าน");
    previewResponse.resolve(
      makeJsonResponse({
        body: {
          invalidIds: [],
          missingIds: [],
          validIds: ["101", "102"],
        },
      }),
    );
    await flushEffects();

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === "/api/admin/home-sections" && init?.method === "PUT",
    );
    const submittedBody = JSON.parse(String(putCall?.[1]?.body));
    expect(submittedBody.sections[0].title).toBe("ค่าที่ส่งบันทึก");

    const descriptionInput = page.container.querySelector(
      "textarea[placeholder='ข้อความสั้น ๆ ที่แสดงใต้หัวข้อชุดบ้านพัก']",
    ) as HTMLTextAreaElement;
    await changeTextArea(descriptionInput, "แก้ระหว่างส่งข้อมูล");
    putResponse.resolve(
      makeJsonResponse({
        body: {
          layout: submittedBody.layout,
          sections: submittedBody.sections,
        },
      }),
    );
    await flushEffects();

    expect(
      (
        page.container.querySelector(
          "input[placeholder='เช่น บ้านพักแนะนำ']",
        ) as HTMLInputElement
      ).value,
    ).toBe("แก้ระหว่างตรวจเลขบ้าน");
    expect(
      (
        page.container.querySelector(
          "textarea[placeholder='ข้อความสั้น ๆ ที่แสดงใต้หัวข้อชุดบ้านพัก']",
        ) as HTMLTextAreaElement
      ).value,
    ).toBe("แก้ระหว่างส่งข้อมูล");
    expect(
      findButton(page.container, "บันทึก")?.hasAttribute("disabled"),
    ).toBe(false);

    await page.unmount();
  });

  it("starts only one save when the save action is triggered twice before token lookup resolves", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout, sections: [savedSection, secondSection] },
        url: "/api/admin/home-sections",
      },
      {
        body: {
          layout: savedLayout,
          sections: [{ ...savedSection, limitCount: 7 }, secondSection],
        },
        method: "PUT",
        url: "/api/admin/home-sections",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSectionsPage />);
    const limitCountInput = page.container.querySelector(
      "input[type='number']",
    ) as HTMLInputElement;
    await changeInput(limitCountInput, "7");

    const saveToken = deferred<string | null>();
    mocks.readAdminAccessToken.mockReturnValue(saveToken.promise);
    const tokenCallsBeforeSave =
      mocks.readAdminAccessToken.mock.calls.length;
    const saveButton = page.container.querySelectorAll(
      "#adminSectionsPageHeader button",
    )[1] as HTMLButtonElement;

    act(() => {
      saveButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      saveButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      saveToken.resolve("admin-token");
      await saveToken.promise;
    });
    await flushEffects();

    expect(
      fetchMock.mock.calls.filter(
        ([url, init]) =>
          url === "/api/admin/home-sections" && init?.method === "PUT",
      ),
    ).toHaveLength(1);
    expect(
      mocks.readAdminAccessToken.mock.calls.length - tokenCallsBeforeSave,
    ).toBe(1);

    await page.unmount();
  });

  it("preserves a selection-only change made while a save is in flight", async () => {
    const putResponse = deferred<Response>();
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (url === "/api/admin/home-sections" && method === "GET") {
          return Promise.resolve(
            makeJsonResponse({
              body: {
                layout: savedLayout,
                sections: [savedSection, secondSection],
              },
            }),
          );
        }
        if (url === "/api/admin/home-sections" && method === "PUT") {
          return putResponse.promise;
        }
        throw new Error(`Unhandled ${method} ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSectionsPage />);
    await changeInput(
      page.container.querySelector("input[type='number']") as HTMLInputElement,
      "7",
    );
    await click(
      page.container.querySelectorAll("#adminSectionsPageHeader button")[1] as HTMLButtonElement,
    );

    const tiktokButton = page.container.querySelector(
      "[data-layout-identity='fixed:tiktok'] [data-layout-select='fixed']",
    ) as HTMLButtonElement;
    await click(tiktokButton);

    putResponse.resolve(
      makeJsonResponse({
        body: {
          layout: savedLayout,
          sections: [{ ...savedSection, limitCount: 7 }, secondSection],
        },
      }),
    );
    await flushEffects();

    expect(
      page.container.querySelector("a[href='/admin/tiktok']"),
    ).not.toBeNull();
    expect(tiktokButton.getAttribute("aria-pressed")).toBe("true");

    await page.unmount();
  });

  it("deletes and saves the final rail", async () => {
    const soleRailLayout = savedLayout.filter(
      (item) => item.kind === "fixed" || item.key === "featured",
    );
    const fetchMock = makeFetchMock([
      {
        body: { layout: soleRailLayout, sections: [savedSection] },
        url: "/api/admin/home-sections",
      },
      {
        body: { layout: fixedOnlyLayout, sections: [] },
        method: "PUT",
        url: "/api/admin/home-sections",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSectionsPage />);
    await click(findButton(page.container, "ลบชุดนี้") as HTMLButtonElement);
    await click(findButton(page.container, "ยืนยันลบ") as HTMLButtonElement);
    await click(findButton(page.container, "บันทึก") as HTMLButtonElement);

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === "/api/admin/home-sections" && init?.method === "PUT",
    );
    expect(JSON.parse(String(putCall?.[1]?.body))).toEqual({
      layout: fixedOnlyLayout,
      sections: [],
    });
    expect(
      page.container.querySelectorAll("[data-layout-select='rail']"),
    ).toHaveLength(0);
    expect(page.container.textContent).toContain("ทำไมต้องเลือกเรา");

    await page.unmount();
  });

  it("shows missing and invalid manual IDs beside the checked rail", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock([
        {
          body: {
            layout: savedLayout.filter(
              (item) =>
                item.kind === "fixed" || item.key === "featured",
            ),
            sections: [manualSection],
          },
          url: "/api/admin/home-sections",
        },
        {
          body: {
            invalidIds: ["102"],
            missingIds: ["101"],
            validIds: [],
          },
          method: "POST",
          url: "/api/admin/home-sections/preview",
        },
      ]),
    );

    const page = await mountAdminPage(<AdminSectionsPage />);
    await click(findButton(page.container, "เช็กเลขบ้าน") as HTMLButtonElement);

    const fieldError = page.container.querySelector(
      "[data-admin-section-field-error='manualIds']",
    );
    expect(fieldError?.textContent).toContain(
      "ไม่พบเลขบ้านในรายการบ้าน: 101",
    );
    expect(fieldError?.textContent).toContain(
      "เลขบ้านรูปแบบไม่ถูกต้อง: 102",
    );
    expect(page.container.textContent).not.toContain("ตรวจเลขบ้านแล้ว");

    await page.unmount();
  });

  it("ignores a stale manual ID check after selecting another section", async () => {
    const previewResponse = deferred<Response>();
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url === "/api/admin/home-sections" && method === "GET") {
          return Promise.resolve(
            makeJsonResponse({
              body: {
                layout: savedLayout,
                sections: [manualSection, secondSection],
              },
            }),
          );
        }
        if (
          url === "/api/admin/home-sections/preview" &&
          method === "POST"
        ) {
          return previewResponse.promise;
        }
        throw new Error(`Unhandled ${method} ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSectionsPage />);
    await click(findButton(page.container, "เช็กเลขบ้าน") as HTMLButtonElement);
    const tiktokButton = page.container.querySelector(
      "[data-layout-identity='fixed:tiktok'] [data-layout-select='fixed']",
    ) as HTMLButtonElement;
    await click(tiktokButton);

    previewResponse.resolve(
      makeJsonResponse({
        body: {
          invalidIds: ["102"],
          missingIds: ["101"],
          validIds: [],
        },
      }),
    );
    await flushEffects();

    expect(
      page.container.querySelector("a[href='/admin/tiktok']"),
    ).not.toBeNull();
    expect(
      page.container.querySelector(
        "[data-admin-section-field-error='manualIds']",
      ),
    ).toBeNull();
    expect(page.container.textContent).not.toContain("ตรวจเลขบ้านแล้ว");

    await page.unmount();
  });

  it("rejects a malformed GET relationship without queuing broken state", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock([
        {
          body: { layout: savedLayout, sections: [savedSection] },
          url: "/api/admin/home-sections",
        },
      ]),
    );

    const page = await mountAdminPage(<AdminSectionsPage />);
    await flushEffects();

    expect(page.container.querySelector("[role='alert']")).not.toBeNull();
    expect(
      page.container.querySelectorAll("[data-layout-identity]"),
    ).toHaveLength(0);
    expect(page.container.textContent).toContain("ไม่สามารถ");

    await page.unmount();
  });

  it("rejects malformed layout fields and extra properties from GET", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock([
        {
          body: {
            layout: [
              { ...savedLayout[0], unexpected: true },
              ...savedLayout.slice(1),
            ],
            sections: [savedSection, secondSection],
          },
          url: "/api/admin/home-sections",
        },
      ]),
    );

    const page = await mountAdminPage(<AdminSectionsPage />);
    await flushEffects();

    expect(page.container.querySelector("[role='alert']")).not.toBeNull();
    expect(
      page.container.querySelectorAll("[data-layout-identity]"),
    ).toHaveLength(0);

    await page.unmount();
  });

  it("rejects a malformed PUT relationship and preserves the live draft", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout, sections: [savedSection, secondSection] },
        url: "/api/admin/home-sections",
      },
      {
        body: { layout: savedLayout, sections: [savedSection] },
        method: "PUT",
        url: "/api/admin/home-sections",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSectionsPage />);
    const limitCountInput = page.container.querySelector(
      "input[type='number']",
    ) as HTMLInputElement;
    await changeInput(limitCountInput, "7");
    await click(findButton(page.container, "บันทึก") as HTMLButtonElement);
    await flushEffects();

    expect(
      (page.container.querySelector("input[type='number']") as HTMLInputElement)
        .value,
    ).toBe("7");
    expect(page.container.querySelector("[role='alert']")).not.toBeNull();
    expect(
      page.container.querySelectorAll("[data-layout-select='rail']"),
    ).toHaveLength(2);
    expect(
      findButton(page.container, "บันทึก")?.hasAttribute("disabled"),
    ).toBe(false);

    await page.unmount();
  });

  it("rejects malformed layout field types from PUT and preserves the live draft", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout, sections: [savedSection, secondSection] },
        url: "/api/admin/home-sections",
      },
      {
        body: {
          layout: [
            { ...savedLayout[0], enabled: "yes" },
            ...savedLayout.slice(1),
          ],
          sections: [{ ...savedSection, limitCount: 7 }, secondSection],
        },
        method: "PUT",
        url: "/api/admin/home-sections",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSectionsPage />);
    await changeInput(
      page.container.querySelector("input[type='number']") as HTMLInputElement,
      "7",
    );
    await click(
      page.container.querySelectorAll("#adminSectionsPageHeader button")[1] as HTMLButtonElement,
    );
    await flushEffects();

    expect(
      (page.container.querySelector("input[type='number']") as HTMLInputElement)
        .value,
    ).toBe("7");
    expect(page.container.querySelector("[role='alert']")).not.toBeNull();
    expect(
      page.container
        .querySelectorAll("#adminSectionsPageHeader button")[1]
        ?.hasAttribute("disabled"),
    ).toBe(false);

    await page.unmount();
  });

  it("keeps only string warnings from a successful PUT response", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { layout: savedLayout, sections: [savedSection, secondSection] },
        url: "/api/admin/home-sections",
      },
      {
        body: {
          layout: savedLayout,
          sections: [{ ...savedSection, limitCount: 7 }, secondSection],
          warnings: ["usable warning", { message: "broken warning" }, 42],
        },
        method: "PUT",
        url: "/api/admin/home-sections",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSectionsPage />);
    await changeInput(
      page.container.querySelector("input[type='number']") as HTMLInputElement,
      "7",
    );
    await click(
      page.container.querySelectorAll("#adminSectionsPageHeader button")[1] as HTMLButtonElement,
    );
    await flushEffects();

    expect(page.container.textContent).toContain("usable warning");
    expect(page.container.textContent).not.toContain("broken warning");

    await page.unmount();
  });
});
