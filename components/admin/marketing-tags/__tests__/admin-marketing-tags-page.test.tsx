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
  replace: vi.fn(),
  router: {
    replace: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/components/admin/admin-auth", () => ({
  readAdminAccessToken: mocks.readAdminAccessToken,
}));

import { AdminMarketingTagsPage } from "../admin-marketing-tags-page";

const trackingSurfaces = [
  {
    eventName: "view_item",
    path: "/villas/[id]",
    status: "ready",
    title: "Villa detail",
  },
];

describe("AdminMarketingTagsPage", () => {
  beforeEach(() => {
    mocks.readAdminAccessToken.mockResolvedValue("admin-token");
    mocks.replace.mockReset();
    mocks.router.replace = mocks.replace;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads marketing tag settings and saves updated GTM IDs", async () => {
    const fetchMock = makeFetchMock([
      {
        body: {
          settings: { googleTagManagerId: "GTM-ABC1234" },
          trackingSurfaces,
        },
        url: "/api/admin/marketing-tags",
      },
      {
        body: {
          settings: { googleTagManagerId: "GTM-ZYX9876" },
          trackingSurfaces,
        },
        method: "PUT",
        url: "/api/admin/marketing-tags",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminMarketingTagsPage />);
    const input = page.container.querySelector(
      "#googleTagManagerId",
    ) as HTMLInputElement | null;

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/marketing-tags",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
      }),
    );
    expect(input?.value).toBe("GTM-ABC1234");
    expect(page.container.querySelector("[data-marketing-guide='ga4']")).not.toBeNull();

    await changeInput(input as HTMLInputElement, "GTM-ZYX9876");
    await click(
      page.container.querySelector(
        "[data-save-marketing-tags]",
      ) as HTMLButtonElement,
    );
    await flushEffects();

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/marketing-tags",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
        method: "PUT",
      }),
    );
    expect(input?.value).toBe("GTM-ZYX9876");

    await page.unmount();
  });

  it("opens detailed GTM setup guide tables in a dialog", async () => {
    const fetchMock = makeFetchMock([
      {
        body: {
          settings: { googleTagManagerId: "GTM-ABC1234" },
          trackingSurfaces,
        },
        url: "/api/admin/marketing-tags",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminMarketingTagsPage />);

    async function openGuide(guideId: string) {
      await click(
        page.container.querySelector(
          `[data-marketing-guide='${guideId}']`,
        ) as HTMLButtonElement,
      );
      await flushEffects();

      return page.container.querySelector("[data-marketing-guide-dialog]");
    }

    let dialog = await openGuide("variables");

    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("ขั้นตอนที่ 2");
    expect(dialog?.textContent).toContain("Data Layer Variable Name");
    expect(dialog?.textContent).toContain("Version 2");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");

    await click(
      dialog?.querySelector("button[aria-label]") as HTMLButtonElement,
    );
    await flushEffects();

    expect(document.body.style.overflow).toBe("");
    expect(document.documentElement.style.overflow).toBe("");

    dialog = await openGuide("triggers");

    expect(dialog?.textContent).toContain("This trigger fires on");
    expect(dialog?.textContent).toContain("DLV - contact_channel");
    expect(dialog?.textContent).toContain("line");

    await click(
      dialog?.querySelector("button[aria-label]") as HTMLButtonElement,
    );
    await flushEffects();

    dialog = await openGuide("ga4");

    expect(dialog?.textContent).toContain("Parameter Name");
    expect(dialog?.textContent).toContain("generate_lead");

    await click(
      dialog?.querySelector("button[aria-label]") as HTMLButtonElement,
    );
    await flushEffects();

    expect(
      page.container.querySelector("[data-marketing-guide-dialog]"),
    ).toBeNull();

    await page.unmount();
  });
});
