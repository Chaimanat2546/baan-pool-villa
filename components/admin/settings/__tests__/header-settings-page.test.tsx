/** @vitest-environment jsdom */
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

  it("keeps the gallery opening controls out of the web style settings page", async () => {
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
    expect(page.container.querySelector("#gallery-modal-style")).toBeNull();
    expect(page.container.textContent).not.toContain("วิธีเปิดดูรูปของบ้าน");
    expect(
      fetchMock.mock.calls.some(
        ([url]) => url === "/api/admin/site-web-styles/gallery",
      ),
    ).toBe(false);
    await page.unmount();
  });
});
