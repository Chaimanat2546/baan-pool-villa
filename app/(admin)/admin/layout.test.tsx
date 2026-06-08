import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin/layout/admin-shell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="admin-shell">{children}</div>
  ),
}));

vi.mock("@/components/layout/site-theme-provider", () => ({
  SiteThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="site-theme-provider">{children}</div>
  ),
}));

vi.mock("@/lib/site-settings/server", () => ({
  getSiteSettings: vi.fn(),
}));

describe("AdminLayout route segment config", () => {
  it("uses the default dynamic behavior instead of forcing every admin route dynamic", async () => {
    const layoutModule = await import("./layout");

    expect("dynamic" in layoutModule).toBe(false);
  });
});
