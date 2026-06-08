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
});
