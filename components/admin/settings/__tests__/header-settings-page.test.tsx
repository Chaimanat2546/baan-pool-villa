/** @vitest-environment jsdom */
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeJsonResponse, mountAdminPage } from "@/components/admin/__tests__/admin-page-dom-test-utils";

const mocks = vi.hoisted(() => ({
  readAdminAccessToken: vi.fn(),
  replace: vi.fn(),
  router: { replace: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/components/admin/admin-auth", () => ({
  readAdminAccessToken: mocks.readAdminAccessToken,
}));

import { SettingsDirtyStateProvider } from "../settings-dirty-state";
import { WebStyleSettingsPage } from "../header-settings-page";

describe("WebStyleSettingsPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the desktop Header save action inside its settings card", async () => {
    mocks.readAdminAccessToken.mockResolvedValue("token");
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(
      url === "/api/admin/site-header-settings"
        ? makeJsonResponse({ body: { settings: { desktopHeaderVariant: "centered-contact" } } })
        : url === "/api/admin/site-web-styles/gallery"
          ? makeJsonResponse({ body: { settings: { variant: "lightbox" } } })
        : url === "/api/admin/villa-card-images"
          ? makeJsonResponse({ body: { villaCardStyle: "classic" } })
          : makeJsonResponse({ body: { settings: {} } }),
    )));

    const page = await mountAdminPage(
      <SettingsDirtyStateProvider><WebStyleSettingsPage /></SettingsDirtyStateProvider>,
    );

    const headerCard = page.container.querySelector("#desktop-header-variant");
    expect(headerCard?.querySelector("[data-header-style-save]")).not.toBeNull();
    expect(headerCard?.querySelector("[data-header-mobile-summary]")).not.toBeNull();
    expect(headerCard?.querySelector("[data-header-preview]")?.className).toContain("hidden");
    expect(
      page.container.querySelector("[data-settings-section-header] [data-header-style-save]"),
    ).toBeNull();

    await page.unmount();
  });

  it("loads, clears, previews, and saves optional Gallery colors", async () => {
    mocks.readAdminAccessToken.mockResolvedValue("token");
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/admin/site-web-styles/gallery" && init?.method === "PATCH") {
        return Promise.resolve(makeJsonResponse({
          body: {
            settings: { textColor: "#111111", variant: "categorized-grid" },
            verified: true,
            warnings: [],
          },
        }));
      }
      if (url === "/api/admin/site-web-styles/gallery") {
        return Promise.resolve(makeJsonResponse({
          body: {
            settings: {
              backgroundColor: "#ffffff",
              textColor: "#111111",
              variant: "categorized-grid",
            },
          },
        }));
      }
      if (url === "/api/admin/site-header-settings") {
        return Promise.resolve(makeJsonResponse({ body: { settings: { desktopHeaderVariant: "centered-contact" } } }));
      }
      if (url === "/api/admin/villa-card-images") {
        return Promise.resolve(makeJsonResponse({ body: { villaCardStyle: "classic" } }));
      }
      return Promise.resolve(makeJsonResponse({ body: { settings: {} } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(
      <SettingsDirtyStateProvider><WebStyleSettingsPage /></SettingsDirtyStateProvider>,
    );
    const galleryCard = page.container.querySelector("#gallery-modal-style");
    expect(galleryCard).not.toBeNull();
    expect(
      galleryCard?.querySelector<HTMLInputElement>('input[name="galleryVariant"][value="categorized-grid"]')?.checked,
    ).toBe(true);
    expect(galleryCard?.querySelector<HTMLInputElement>("#galleryBackgroundColor")?.value).toBe("#ffffff");
    expect(galleryCard?.textContent).toContain("เปิดรูปใหญ่ทันที");
    expect(galleryCard?.textContent).toContain("ดูรูปทั้งหมดแยกตามหมวดก่อน");

    const categorizedPreview = galleryCard?.querySelector(
      '[data-gallery-style-preview][data-gallery-preview-variant="categorized-grid"]',
    );
    expect(categorizedPreview).not.toBeNull();
    expect(categorizedPreview?.textContent).toContain("ตัวอย่างที่ลูกค้าจะเห็น");
    expect(categorizedPreview?.querySelector("[data-gallery-preview-categories]")).not.toBeNull();
    expect(categorizedPreview?.querySelectorAll("[data-gallery-preview-image]").length).toBeGreaterThan(2);
    expect(categorizedPreview?.querySelector("[data-gallery-preview-thumbnails]")).toBeNull();

    act(() => {
      galleryCard
        ?.querySelector<HTMLInputElement>(
          'input[name="galleryVariant"][value="lightbox"]',
        )
        ?.click();
    });

    const directPreview = galleryCard?.querySelector(
      '[data-gallery-style-preview][data-gallery-preview-variant="lightbox"]',
    );
    expect(directPreview).not.toBeNull();
    expect(directPreview?.querySelector("[data-gallery-preview-main-image]")?.textContent).toBe(
      "รูปภาพ",
    );
    expect(directPreview?.querySelector("[data-gallery-preview-thumbnails]")).not.toBeNull();
    expect(directPreview?.querySelector("[data-gallery-preview-categories]")).toBeNull();

    act(() => {
      galleryCard
        ?.querySelector<HTMLInputElement>(
          'input[name="galleryVariant"][value="categorized-grid"]',
        )
        ?.click();
    });

    act(() => {
      galleryCard?.querySelector<HTMLButtonElement>("[data-clear-gallery-background]")?.click();
    });
    expect(galleryCard?.querySelector<HTMLInputElement>("#galleryBackgroundColor")?.value).toBe("");

    await act(async () => {
      galleryCard?.querySelector<HTMLButtonElement>("[data-gallery-style-save]")?.click();
    });

    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/admin/site-web-styles/gallery" && init?.method === "PATCH",
    );
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
      backgroundColor: "",
      textColor: "#111111",
      variant: "categorized-grid",
    });
    await page.unmount();
  });
});
