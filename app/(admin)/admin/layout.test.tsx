import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getSiteSettings: vi.fn(),
}));

vi.mock("@/components/admin/layout/admin-shell", () => ({
  AdminShell: ({
    children,
    initialDesktopNavCollapsed,
  }: {
    children: React.ReactNode;
    initialDesktopNavCollapsed?: boolean;
  }) => (
    <div
      data-initial-desktop-nav-collapsed={String(initialDesktopNavCollapsed)}
      data-testid="admin-shell"
    >
      {children}
    </div>
  ),
}));

vi.mock("@/components/layout/site-theme-provider", () => ({
  SiteThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="site-theme-provider">{children}</div>
  ),
}));

vi.mock("@/lib/site-settings/server", () => ({
  getSiteSettings: mocks.getSiteSettings,
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

describe("AdminLayout route segment config", () => {
  beforeEach(() => {
    mocks.getSiteSettings.mockResolvedValue({ settings: DEFAULT_SITE_SETTINGS });
    mocks.cookies.mockResolvedValue({
      get: vi.fn(() => undefined),
    });
  });

  it("uses the default dynamic behavior instead of forcing every admin route dynamic", async () => {
    const layoutModule = await import("./layout");

    expect("dynamic" in layoutModule).toBe(false);
  });

  it("passes the collapsed sidebar cookie into the shell", async () => {
    mocks.cookies.mockResolvedValue({
      get: vi.fn((name: string) =>
        name === "admin-sidebar-collapsed" ? { value: "true" } : undefined,
      ),
    });
    const layoutModule = await import("./layout");
    const markup = renderToStaticMarkup(
      await layoutModule.default({ children: <div>settings</div> }),
    );

    expect(markup).toContain('data-initial-desktop-nav-collapsed="true"');
  });
});
