/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, useState } from "react";

import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import {
  click,
  flushEffects,
  mountAdminPage,
} from "@/components/admin/__tests__/admin-page-dom-test-utils";

const mocks = vi.hoisted(() => {
  const replace = vi.fn();
  return {
    pathname: "/admin/settings",
    replace,
    router: { replace },
    signOut: vi.fn(),
    readState: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => mocks.router,
}));

vi.mock("@/lib/home-sections/supabase", () => ({
  createBrowserHomeConfigClient: () => ({
    auth: {
      signOut: mocks.signOut,
    },
  }),
}));
vi.mock("@/components/admin/admin-auth", () => ({
  readAdminSessionState: mocks.readState,
}));

import { AdminShell } from "../admin-shell";

describe("AdminShell", () => {
  beforeEach(() => {
    mocks.pathname = "/admin/settings";
    mocks.replace.mockReset();
    mocks.signOut.mockReset();
    mocks.readState.mockReset();
    mocks.readState.mockResolvedValue("active");
    window.localStorage.clear();
    document.cookie = "admin-sidebar-collapsed=; path=/; max-age=0";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses document navigation for admin navigation links", async () => {
    const page = await mountAdminPage(
      <AdminShell settings={DEFAULT_SITE_SETTINGS}>
        <div>settings</div>
      </AdminShell>,
    );

    const navLinks = Array.from(page.container.querySelectorAll("nav a"));

    expect(navLinks.length).toBeGreaterThan(0);
    expect(navLinks.every((link) => link.hasAttribute("href"))).toBe(true);
    expect(navLinks.some((link) => link.hasAttribute("data-prefetch"))).toBe(false);

    await page.unmount();
  });

  it("loads the collapsed desktop sidebar preference from localStorage", async () => {
    window.localStorage.setItem("admin-sidebar-collapsed", "true");

    const page = await mountAdminPage(
      <AdminShell settings={DEFAULT_SITE_SETTINGS}>
        <div>settings</div>
      </AdminShell>,
    );

    expect(
      page.container.querySelector('[data-admin-sidebar-state="collapsed"]'),
    ).not.toBeNull();
    expect(
      page.container.querySelector('[data-admin-nav-layout="collapsed"]'),
    ).not.toBeNull();
    expect(document.cookie).toContain("admin-sidebar-collapsed=true");

    await page.unmount();
  });

  it("uses the server sidebar preference before localStorage is available", async () => {
    const page = await mountAdminPage(
      <AdminShell
        initialDesktopNavCollapsed
        settings={DEFAULT_SITE_SETTINGS}
      >
        <div>settings</div>
      </AdminShell>,
    );

    expect(window.localStorage.getItem("admin-sidebar-collapsed")).toBeNull();
    expect(
      page.container.querySelector('[data-admin-sidebar-state="collapsed"]'),
    ).not.toBeNull();

    await page.unmount();
  });

  it("persists the desktop sidebar preference when toggled", async () => {
    const page = await mountAdminPage(
      <AdminShell settings={DEFAULT_SITE_SETTINGS}>
        <div>settings</div>
      </AdminShell>,
    );

    const toggle = page.container.querySelector(
      'button[aria-label="ย่อแถบเมนูหลังบ้าน"]',
    );

    expect(toggle).not.toBeNull();
    await click(toggle as HTMLButtonElement);

    expect(window.localStorage.getItem("admin-sidebar-collapsed")).toBe("true");
    expect(document.cookie).toContain("admin-sidebar-collapsed=true");
    expect(
      page.container.querySelector('[data-admin-sidebar-state="collapsed"]'),
    ).not.toBeNull();

    await page.unmount();
  });

  it("renders only enabled admin navigation items", async () => {
    const page = await mountAdminPage(
      <AdminShell settings={DEFAULT_SITE_SETTINGS}>
        <div>settings</div>
      </AdminShell>,
    );

    const navLinks = Array.from(page.container.querySelectorAll("nav a"));
    const linkTargets = navLinks.map((link) => link.getAttribute("href"));
    const disabledItems = page.container.querySelectorAll('nav [aria-disabled="true"]');

    expect(linkTargets).toContain("/admin/customer-reviews");
    expect(linkTargets).toContain("/admin/tiktok");
    expect(linkTargets).not.toContain("/admin/villas");
    expect(linkTargets).not.toContain("/admin/images");
    expect(linkTargets).not.toContain("/admin/users");
    expect(disabledItems).toHaveLength(0);

    await page.unmount();
  });

  it("renders the reset password page without the admin navigation shell", async () => {
    mocks.pathname = "/admin/reset-password";

    const page = await mountAdminPage(
      <AdminShell settings={DEFAULT_SITE_SETTINGS}>
        <div>reset form</div>
      </AdminShell>,
    );

    expect(page.container.textContent).toContain("reset form");
    expect(page.container.querySelector("nav")).toBeNull();
    expect(
      page.container.querySelector('[data-admin-sidebar-state]'),
    ).toBeNull();

    await page.unmount();
  });

  it("renders the forced password page without the admin navigation shell", async () => {
    mocks.pathname = "/admin/change-password";

    const page = await mountAdminPage(
      <AdminShell settings={DEFAULT_SITE_SETTINGS}>
        <div>forced form</div>
      </AdminShell>,
    );

    expect(page.container.textContent).toContain("forced form");
    expect(page.container.querySelector("nav")).toBeNull();
    expect(mocks.readState).not.toHaveBeenCalled();
    await page.unmount();
  });

  it("redirects a forced session before exposing protected shell mutations", async () => {
    mocks.readState.mockResolvedValue("forced");

    const page = await mountAdminPage(
      <AdminShell settings={DEFAULT_SITE_SETTINGS}>
        <div>settings</div>
      </AdminShell>,
    );
    await flushEffects();

    expect(mocks.replace).toHaveBeenCalledWith("/admin/change-password");
    expect(page.container.querySelector("nav")).toBeNull();
    expect(page.container.querySelector("button")).toBeNull();
    await page.unmount();
  });

  it("surfaces verification failure without redirecting it to login", async () => {
    mocks.readState.mockResolvedValue("verification_failed");

    const page = await mountAdminPage(
      <AdminShell settings={DEFAULT_SITE_SETTINGS}>
        <div>settings</div>
      </AdminShell>,
    );
    await flushEffects();

    expect(page.container.textContent).toContain(
      "ไม่สามารถตรวจสอบสิทธิ์แอดมินได้",
    );
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(page.container.querySelector("nav")).toBeNull();
    await page.unmount();
  });

  it("hides a newly navigated protected page until its pathname-specific check completes", async () => {
    let navigate: (() => void) | undefined;
    function Harness() {
      const [, rerender] = useState(0);
      navigate = () => {
        mocks.pathname = "/admin/guides";
        rerender((value) => value + 1);
      };
      return (
        <AdminShell settings={DEFAULT_SITE_SETTINGS}>
          <button type="button">mutate protected data</button>
        </AdminShell>
      );
    }

    const page = await mountAdminPage(<Harness />);
    expect(page.container.querySelector("nav")).not.toBeNull();

    let resolveNext: ((state: string) => void) | undefined;
    mocks.readState.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveNext = resolve;
      }),
    );
    act(() => navigate?.());

    expect(page.container.querySelector("nav")).toBeNull();
    expect(page.container.textContent).not.toContain("mutate protected data");

    await flushEffects();
    expect(resolveNext).toBeTypeOf("function");
    await act(async () => {
      resolveNext?.("forced");
      await Promise.resolve();
    });
    expect(mocks.replace).toHaveBeenCalledWith("/admin/change-password");
    await page.unmount();
  });
});
