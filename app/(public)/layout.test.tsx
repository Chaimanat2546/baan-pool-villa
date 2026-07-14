import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import { getSiteSettings } from "@/lib/site-settings/server";

vi.mock("@/components/layout/mobile-bottom-nav", () => ({
  MobileBottomNav: () => <nav data-testid="mobile-bottom-nav" />,
}));

vi.mock("@/components/layout/site-footer", () => ({
  SiteFooter: () => <footer data-testid="site-footer" />,
}));

vi.mock("@/components/layout/site-header", () => ({
  SiteHeader: () => <header data-testid="site-header" />,
}));

vi.mock("@/components/layout/site-theme-provider", () => ({
  SiteThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="site-theme-provider">{children}</div>
  ),
}));

vi.mock("@/components/villas/listing/villa-card-style-context", () => ({
  VillaCardStyleProvider: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => (
    <section data-villa-card-style-provider={value}>{children}</section>
  ),
}));

vi.mock("@/lib/site-settings/server", () => ({
  getSiteSettings: vi.fn(),
}));

const mockedGetSiteSettings = vi.mocked(getSiteSettings);

describe("PublicLayout", () => {
  beforeEach(() => {
    mockedGetSiteSettings.mockReset();
  });

  it("passes the site villa card style setting to public page content", async () => {
    mockedGetSiteSettings.mockResolvedValue({
      degraded: false,
      settings: {
        ...DEFAULT_SITE_SETTINGS,
        villaCardStyle: "gallery",
      },
      source: "database",
    });

    const PublicLayout = (await import("./layout")).default;
    const element = await PublicLayout({
      children: <main>ชุดบ้านพัก</main>,
    });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain('data-villa-card-style-provider="gallery"');
    expect(markup).toContain("ชุดบ้านพัก");
    expect(markup).toContain("min-h-full pb-32 md:pb-0");
  });
});
