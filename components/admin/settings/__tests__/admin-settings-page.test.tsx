/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import {
  changeInput,
  click,
  flushEffects,
  makeFetchMock,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  readAdminAccessToken: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  router: {
    refresh: vi.fn(),
    replace: vi.fn(),
  },
  signOut: vi.fn(),
  signInWithOtp: vi.fn(),
  updateUser: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/components/admin/admin-auth", () => ({
  readAdminAccessToken: mocks.readAdminAccessToken,
}));

vi.mock("@/lib/home-sections/supabase", () => ({
  createBrowserHomeConfigClient: () => ({
    auth: {
      getUser: mocks.getUser,
      signOut: mocks.signOut,
      signInWithOtp: mocks.signInWithOtp,
      updateUser: mocks.updateUser,
      verifyOtp: mocks.verifyOtp,
    },
  }),
}));

import { AdminSettingsPage } from "../admin-settings-page";

describe("AdminSettingsPage", () => {
  beforeEach(() => {
    mocks.readAdminAccessToken.mockResolvedValue("admin-token");
    mocks.refresh.mockReset();
    mocks.replace.mockReset();
    mocks.router.refresh = mocks.refresh;
    mocks.router.replace = mocks.replace;
    mocks.getUser.mockResolvedValue({
      data: { user: { email: "admin@example.com" } },
      error: null,
    });
    mocks.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    mocks.updateUser.mockResolvedValue({
      data: { user: { id: "admin-user" } },
      error: null,
    });
    mocks.verifyOtp.mockResolvedValue({
      data: {
        session: { access_token: "otp-token" },
        user: { email: "admin@example.com" },
      },
      error: null,
    });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.getUser.mockClear();
    mocks.signOut.mockClear();
    mocks.signInWithOtp.mockClear();
    mocks.updateUser.mockClear();
    mocks.verifyOtp.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("confirms tags-only external data refresh before sending the request", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { settings: DEFAULT_SITE_SETTINGS },
        url: "/api/admin/site-settings",
      },
      {
        body: { message: "refresh complete", refreshed: true, scope: "tags-only" },
        method: "POST",
        url: "/api/admin/external-data/refresh",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSettingsPage />);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/site-settings",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
      }),
    );
    expect(page.container.querySelector("#settingsPageHeader")).not.toBeNull();

    const headerButtons = Array.from(
      page.container.querySelectorAll("#settingsPageHeader button"),
    );
    const refreshButton = headerButtons[0] ?? null;
    expect(refreshButton).not.toBeNull();

    await click(refreshButton as HTMLButtonElement);

    expect(
      fetchMock.mock.calls.filter(([url]) => {
        return url === "/api/admin/external-data/refresh";
      }),
    ).toHaveLength(0);

    await click(refreshButton as HTMLButtonElement);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/external-data/refresh",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer admin-token",
          "x-admin-refresh-confirmation": "external-villa-cache",
          "x-admin-refresh-scope": "tags-only",
        },
        method: "POST",
      }),
    );
    expect(page.container.querySelector("[role='status']")).not.toBeNull();
    expect(mocks.refresh).not.toHaveBeenCalled();

    await click(refreshButton as HTMLButtonElement);

    expect(
      fetchMock.mock.calls.filter(([url]) => {
        return url === "/api/admin/external-data/refresh";
      }),
    ).toHaveLength(1);

    await page.unmount();
  });

  it("renders only one external data refresh action", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { settings: DEFAULT_SITE_SETTINGS },
        url: "/api/admin/site-settings",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSettingsPage />);
    const headerButtons = Array.from(
      page.container.querySelectorAll("#settingsPageHeader button"),
    );
    const refreshButton = headerButtons[0] ?? null;
    const saveButton = headerButtons[1] ?? null;

    expect(headerButtons).toHaveLength(2);
    expect(refreshButton).not.toBeNull();
    expect(saveButton).not.toBeNull();

    await page.unmount();
  });

  it("keeps the external refresh header action visible below large screens", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { settings: DEFAULT_SITE_SETTINGS },
        url: "/api/admin/site-settings",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSettingsPage />);
    const headerButtons = Array.from(
      page.container.querySelectorAll("#settingsPageHeader button"),
    );
    const tagsOnlyButton = headerButtons[0] ?? null;
    const saveButton = headerButtons[1] ?? null;

    expect(headerButtons).toHaveLength(2);
    expect(tagsOnlyButton).not.toBeNull();
    expect(saveButton).not.toBeNull();
    expect(tagsOnlyButton?.className).not.toContain("hidden");

    await page.unmount();
  });

  it("reuses the save response instead of reloading settings after save", async () => {
    const savedSettings = {
      ...DEFAULT_SITE_SETTINGS,
      siteName: "Baan Pool Villa Updated",
    };
    const fetchMock = makeFetchMock([
      {
        body: { settings: DEFAULT_SITE_SETTINGS },
        url: "/api/admin/site-settings",
      },
      {
        body: { settings: savedSettings, warnings: [] },
        method: "PUT",
        url: "/api/admin/site-settings",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSettingsPage />);
    await flushEffects();
    const siteNameInput = page.container.querySelector(
      "#siteName",
    ) as HTMLInputElement | null;

    expect(siteNameInput).not.toBeNull();

    await changeInput(siteNameInput as HTMLInputElement, savedSettings.siteName);
    const callsBeforeSave = fetchMock.mock.calls.length;

    const headerButtons = Array.from(
      page.container.querySelectorAll("#settingsPageHeader button"),
    );
    const saveButton = headerButtons[1] ?? null;

    expect(saveButton).not.toBeNull();

    await click(saveButton as HTMLButtonElement);
    await flushEffects();

    expect(fetchMock.mock.calls.length - callsBeforeSave).toBe(1);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/site-settings",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
        method: "PUT",
      }),
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(page.container.textContent).toContain(savedSettings.siteName);

    await page.unmount();
  });

  it("blocks invalid settings before sending a save request", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { settings: DEFAULT_SITE_SETTINGS },
        url: "/api/admin/site-settings",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSettingsPage />);
    await flushEffects();
    const siteNameInput = page.container.querySelector(
      "#siteName",
    ) as HTMLInputElement | null;

    expect(siteNameInput).not.toBeNull();

    await changeInput(siteNameInput as HTMLInputElement, " ");

    const headerButtons = Array.from(
      page.container.querySelectorAll("#settingsPageHeader button"),
    );
    const saveButton = headerButtons[1] ?? null;

    expect(saveButton).not.toBeNull();

    await click(saveButton as HTMLButtonElement);
    await flushEffects();

    expect(
      fetchMock.mock.calls.filter(([url, init]) => {
        return url === "/api/admin/site-settings" && init?.method === "PUT";
      }),
    ).toHaveLength(0);
    expect(page.container.textContent).toContain("ต้องใส่ชื่อเว็บ");

    await page.unmount();
  });

  it("changes the admin password, signs out, and does not save site settings", async () => {
    const fetchMock = makeFetchMock([
      {
        body: { settings: DEFAULT_SITE_SETTINGS },
        url: "/api/admin/site-settings",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const page = await mountAdminPage(<AdminSettingsPage />);
    await flushEffects();

    await click(
      Array.from(page.container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("เปลี่ยนรหัสผ่าน"),
      ) as HTMLButtonElement,
    );
    await click(
      Array.from(page.container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("ส่งรหัส OTP ไปอีเมล"),
      ) as HTMLButtonElement,
    );
    await flushEffects();
    await changeInput(
      page.container.querySelector("#adminPasswordOtp") as HTMLInputElement,
      "123456",
    );
    await changeInput(
      page.container.querySelector("#adminNewPassword") as HTMLInputElement,
      "new-password-123",
    );
    await changeInput(
      page.container.querySelector("#adminConfirmPassword") as HTMLInputElement,
      "new-password-123",
    );
    await click(
      Array.from(page.container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("ยืนยันและเปลี่ยนรหัสผ่าน"),
      ) as HTMLButtonElement,
    );
    await flushEffects();

    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      email: "admin@example.com",
      token: "123456",
      type: "email",
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({
      password: "new-password-123",
    });
    expect(mocks.signOut).toHaveBeenCalledWith();
    expect(mocks.replace).toHaveBeenCalledWith("/admin/login");
    expect(
      fetchMock.mock.calls.filter(([url, init]) => {
        return url === "/api/admin/site-settings" && init?.method === "PUT";
      }),
    ).toHaveLength(0);

    await page.unmount();
  });
});
