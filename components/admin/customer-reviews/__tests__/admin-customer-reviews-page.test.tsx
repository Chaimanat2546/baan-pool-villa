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
import type { AdminCustomerReviewImage } from "@/lib/customer-reviews/types";

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
    <span aria-label={alt} data-src={src} role="img" />
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

import { AdminCustomerReviewsPage } from "../admin-customer-reviews-page";

function makeReviewImage(id: string, index: number): AdminCustomerReviewImage {
  return {
    alt: `รีวิว ${index}`,
    createdAt: "2026-07-10T01:00:00.000Z",
    homepageOrder: index <= 2 ? index : null,
    id,
    isActive: true,
    isHomepage: index <= 2,
    path: `customer-reviews/2026/07/review-${index}.webp`,
    updatedAt: "2026-07-10T01:00:00.000Z",
    url: `/api/test-review-${index}.webp`,
  };
}

function findButtonByText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  ) as HTMLButtonElement | undefined;
}

function getQueueButtons(container: HTMLElement, action: string) {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>(
      `[data-review-queue-action="${action}"]`,
    ),
  );
}

describe("AdminCustomerReviewsPage", () => {
  beforeEach(() => {
    mocks.readAdminAccessToken.mockResolvedValue("admin-token");
    mocks.replace.mockReset();
    mocks.router.replace = mocks.replace;
    mocks.signOut.mockReset();
    mocks.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.textContent = "";
  });

  it("separates bulk delete selection from homepage ordering controls", async () => {
    const images = [
      makeReviewImage("review-1", 1),
      makeReviewImage("review-2", 2),
      makeReviewImage("review-3", 3),
    ];
    const fetchMock = makeFetchMock([
      {
        body: {
          images,
          layout: "proof_wall",
          queueImageIds: ["review-1", "review-2"],
        },
        url: "/api/admin/customer-reviews",
      },
      {
        body: { deletedImageIds: images.map((image) => image.id) },
        method: "DELETE",
        url: "/api/admin/customer-reviews?ids=review-1,review-2,review-3",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminCustomerReviewsPage />);
    await flushEffects();

    expect(page.container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(findButtonByText(page.container, "แทนที่")).toBeUndefined();
    expect(findButtonByText(page.container, "ซ่อน")).toBeUndefined();
    expect(page.container.querySelector("select")).toBeNull();
    expect(getQueueButtons(page.container, "move-down")[0]?.disabled).toBe(false);

    const deleteModeButton = page.container.querySelector(
      "[data-review-delete-mode-toggle]",
    ) as HTMLButtonElement | null;
    expect(deleteModeButton).toBeDefined();
    expect(deleteModeButton?.closest("section")?.className).toContain("flex-col");
    expect(deleteModeButton?.closest("section")?.className).not.toContain(
      "grid-rows-[auto_minmax(0,1fr)]",
    );
    await click(deleteModeButton as HTMLButtonElement);

    let checkboxes = Array.from(
      page.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
    expect(checkboxes).toHaveLength(3);
    expect(getQueueButtons(page.container, "move-up").every((button) => button.disabled)).toBe(
      true,
    );
    expect(
      getQueueButtons(page.container, "move-down").every((button) => button.disabled),
    ).toBe(true);
    expect(getQueueButtons(page.container, "remove").every((button) => button.disabled)).toBe(
      true,
    );

    await click(deleteModeButton as HTMLButtonElement);
    expect(page.container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(getQueueButtons(page.container, "move-down")[0]?.disabled).toBe(false);

    await click(deleteModeButton as HTMLButtonElement);
    checkboxes = Array.from(
      page.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
    expect(checkboxes).toHaveLength(3);

    await click(
      page.container.querySelector(
        '[data-review-library-image-id="review-1"]',
      ) as HTMLButtonElement,
    );
    checkboxes = Array.from(
      page.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
    expect(checkboxes.filter((checkbox) => checkbox.checked)).toHaveLength(1);

    const selectAllButton = findButtonByText(page.container, "เลือกทั้งหมด");
    expect(selectAllButton).toBeDefined();
    await click(selectAllButton as HTMLButtonElement);
    checkboxes = Array.from(
      page.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
    expect(checkboxes.every((checkbox) => checkbox.checked)).toBe(true);

    await click(findButtonByText(page.container, "ลบที่เลือก") as HTMLButtonElement);
    expect(
      fetchMock.mock.calls.filter(
        ([url, init]) =>
          url === "/api/admin/customer-reviews?ids=review-1,review-2,review-3" &&
          (init as RequestInit | undefined)?.method === "DELETE",
      ),
    ).toHaveLength(0);

    await click(findButtonByText(page.container, "ยืนยันลบที่เลือก") as HTMLButtonElement);
    expect(
      fetchMock.mock.calls.filter(
        ([url, init]) =>
          url === "/api/admin/customer-reviews?ids=review-1,review-2,review-3" &&
          (init as RequestInit | undefined)?.method === "DELETE",
      ),
    ).toHaveLength(1);
    expect(page.container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);

    await page.unmount();
  });
});
