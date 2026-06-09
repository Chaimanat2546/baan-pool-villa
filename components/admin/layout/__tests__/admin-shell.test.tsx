/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import { mountAdminPage } from "@/components/admin/__tests__/admin-page-dom-test-utils";

const mocks = vi.hoisted(() => ({
  pathname: "/admin/settings",
  replace: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({
    replace: mocks.replace,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean | null;
  }) => (
    <a data-href={href} data-prefetch={String(prefetch)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/home-sections/supabase", () => ({
  createBrowserHomeConfigClient: () => ({
    auth: {
      signOut: mocks.signOut,
    },
  }),
}));

import { AdminShell } from "../admin-shell";

describe("AdminShell", () => {
  beforeEach(() => {
    mocks.pathname = "/admin/settings";
    mocks.replace.mockReset();
    mocks.signOut.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("disables Next prefetch for admin navigation links", async () => {
    const page = await mountAdminPage(
      <AdminShell settings={DEFAULT_SITE_SETTINGS}>
        <div>settings</div>
      </AdminShell>,
    );

    const navLinks = Array.from(page.container.querySelectorAll("nav a"));

    expect(navLinks.length).toBeGreaterThan(0);
    expect(navLinks.every((link) => link.getAttribute("data-prefetch") === "false")).toBe(
      true,
    );

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
    toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(window.localStorage.getItem("admin-sidebar-collapsed")).toBe("true");
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
    const linkTargets = navLinks.map((link) => link.getAttribute("data-href"));
    const disabledItems = page.container.querySelectorAll('nav [aria-disabled="true"]');

    expect(linkTargets).toContain("/admin/tiktok");
    expect(linkTargets).not.toContain("/admin/villas");
    expect(linkTargets).not.toContain("/admin/images");
    expect(linkTargets).not.toContain("/admin/users");
    expect(disabledItems).toHaveLength(0);

    await page.unmount();
  });
});
