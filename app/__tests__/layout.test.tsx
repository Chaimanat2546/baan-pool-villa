import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import type { SiteSettings } from "@/lib/site-settings/types";
import { getSiteSettings } from "@/lib/site-settings/server";

vi.mock("next/font/google", () => ({
  Prompt: () => ({
    variable: "--font-prompt",
  }),
}));

vi.mock("next/script", () => ({
  default: ({
    children,
    id,
    src,
  }: {
    children?: ReactNode;
    id?: string;
    src?: string;
  }) => (
    <span data-next-script-id={id} data-next-script-src={src}>
      {children}
    </span>
  ),
}));

vi.mock("@/lib/site-settings/server", () => ({
  getSiteSettings: vi.fn(),
}));

import RootLayout from "../layout";

const getSiteSettingsMock = vi.mocked(getSiteSettings);

async function renderRootLayout(settings: SiteSettings = DEFAULT_SITE_SETTINGS) {
  getSiteSettingsMock.mockResolvedValue({
    degraded: false,
    settings,
    source: "config",
  });

  const element = await RootLayout({
    children: <div>Page content</div>,
  });

  return renderToStaticMarkup(element);
}

describe("RootLayout", () => {
  it("keeps body text selectable for copy-friendly content", async () => {
    const markup = await renderRootLayout();

    expect(markup).not.toContain("select-none");
  });

  it("does not render GTM scripts when no GTM ID is configured", async () => {
    const markup = await renderRootLayout();

    expect(markup).not.toContain("<script");
    expect(markup).not.toContain("googletagmanager.com");
  });

  it("renders Google Tag Manager script and noscript iframe from site settings", async () => {
    const markup = await renderRootLayout({
      ...DEFAULT_SITE_SETTINGS,
      googleTagManagerId: "GTM-ABC1234",
    } as unknown as SiteSettings);

    expect(markup).toContain("https://www.googletagmanager.com/gtm.js?id=GTM-ABC1234");
    expect(markup).toContain("https://www.googletagmanager.com/ns.html?id=GTM-ABC1234");
    expect(markup).toContain("window.dataLayer = window.dataLayer || []");
  });
});
