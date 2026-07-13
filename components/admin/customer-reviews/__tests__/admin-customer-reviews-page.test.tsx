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

import {
  AdminCustomerReviewsPage,
  exportCanvasAsReviewImage,
} from "../admin-customer-reviews-page";

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

function countDeleteCalls(fetchMock: ReturnType<typeof makeFetchMock>, url: string) {
  return fetchMock.mock.calls.filter(
    ([requestUrl, init]) =>
      requestUrl === url && (init as RequestInit | undefined)?.method === "DELETE",
  ).length;
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

    await click(
      page.container.querySelector("[data-review-delete-submit]") as HTMLButtonElement,
    );
    const bulkDeleteDialog = page.container.querySelector(
      "[data-review-delete-dialog]",
    );
    expect(bulkDeleteDialog).not.toBeNull();
    expect(
      bulkDeleteDialog?.querySelectorAll('img[src^="/api/test-review-"]'),
    ).toHaveLength(3);
    expect(
      countDeleteCalls(
        fetchMock,
        "/api/admin/customer-reviews?ids=review-1,review-2,review-3",
      ),
    ).toBe(0);

    await click(
      page.container.querySelector("[data-review-delete-confirm]") as HTMLButtonElement,
    );
    expect(
      countDeleteCalls(
        fetchMock,
        "/api/admin/customer-reviews?ids=review-1,review-2,review-3",
      ),
    ).toBe(1);
    expect(page.container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);

    await page.unmount();
  });

  it("opens a preview dialog before deleting one review image", async () => {
    const images = [makeReviewImage("review-1", 1), makeReviewImage("review-2", 2)];
    const fetchMock = makeFetchMock([
      {
        body: {
          images,
          layout: "proof_wall",
          queueImageIds: ["review-1"],
        },
        url: "/api/admin/customer-reviews",
      },
      {
        body: { deletedImageId: "review-1" },
        method: "DELETE",
        url: "/api/admin/customer-reviews?id=review-1",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminCustomerReviewsPage />);
    await flushEffects();

    await click(
      page.container.querySelector(
        '[data-review-delete-image="review-1"]',
      ) as HTMLButtonElement,
    );
    const deleteDialog = page.container.querySelector("[data-review-delete-dialog]");
    expect(deleteDialog).not.toBeNull();
    expect(
      deleteDialog?.querySelector('img[src="/api/test-review-1.webp"]'),
    ).not.toBeNull();
    expect(countDeleteCalls(fetchMock, "/api/admin/customer-reviews?id=review-1")).toBe(0);

    await click(
      page.container.querySelector("[data-review-delete-confirm]") as HTMLButtonElement,
    );
    expect(countDeleteCalls(fetchMock, "/api/admin/customer-reviews?id=review-1")).toBe(1);
    expect(page.container.querySelector("[data-review-delete-dialog]")).toBeNull();

    await page.unmount();
  });

  it("falls back to data URL WebP export when canvas toBlob does not return WebP", async () => {
    const canvas = {
      toBlob: vi.fn((callback: BlobCallback) => {
        callback(new Blob(["png"], { type: "image/png" }));
      }),
      toDataURL: vi.fn(() => `data:image/webp;base64,${btoa("webp")}`),
    } as unknown as HTMLCanvasElement;

    const image = await exportCanvasAsReviewImage(canvas);

    expect(image.extension).toBe("webp");
    expect(image.blob.type).toBe("image/webp");
    expect(await image.blob.text()).toBe("webp");
  });

  it("uses JPEG export when the browser cannot export canvas WebP", async () => {
    const canvas = {
      toBlob: vi.fn((callback: BlobCallback, mimeType?: string) => {
        callback(
          new Blob([mimeType === "image/jpeg" ? "jpeg" : "png"], {
            type: mimeType === "image/jpeg" ? "image/jpeg" : "image/png",
          }),
        );
      }),
      toDataURL: vi.fn((mimeType?: string) =>
        mimeType === "image/jpeg"
          ? `data:image/jpeg;base64,${btoa("jpeg")}`
          : `data:image/png;base64,${btoa("png")}`,
      ),
    } as unknown as HTMLCanvasElement;

    const image = await exportCanvasAsReviewImage(canvas);

    expect(image.extension).toBe("jpg");
    expect(image.blob.type).toBe("image/jpeg");
    expect(await image.blob.text()).toBe("jpeg");
  });

  it("uses PNG export when the browser cannot export canvas WebP or JPEG", async () => {
    const canvas = {
      toBlob: vi.fn((callback: BlobCallback, mimeType?: string) => {
        callback(
          new Blob([mimeType === "image/png" ? "png" : "fallback"], {
            type: mimeType === "image/png" ? "image/png" : "image/octet-stream",
          }),
        );
      }),
      toDataURL: vi.fn((mimeType?: string) =>
        mimeType === "image/png"
          ? `data:image/png;base64,${btoa("png")}`
          : `data:image/octet-stream;base64,${btoa("fallback")}`,
      ),
    } as unknown as HTMLCanvasElement;

    const image = await exportCanvasAsReviewImage(canvas);

    expect(image.extension).toBe("png");
    expect(image.blob.type).toBe("image/png");
    expect(await image.blob.text()).toBe("png");
  });
});
