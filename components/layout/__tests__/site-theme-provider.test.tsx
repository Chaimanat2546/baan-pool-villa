import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";

import { SiteThemeProvider } from "../site-theme-provider";

describe("SiteThemeProvider", () => {
  it("inlines scoped theme variables from resolved CMS settings", () => {
    const markup = renderToStaticMarkup(
      <SiteThemeProvider settings={DEFAULT_SITE_SETTINGS}>
        <main>Content</main>
      </SiteThemeProvider>,
    );

    expect(markup).toContain('class="site-theme min-h-full"');
    expect(markup).toContain("<style>");
    expect(markup).toContain(".site-theme{");
    expect(markup).toContain("--site-header-link:#ffffff");
    expect(markup).toContain("--site-header-link-hover:#eab308");
    expect(markup).toContain("--site-footer-link:#ffffff");
    expect(markup).toContain("--site-footer-link-hover:#eab308");
    expect(markup).toContain("--site-bank-highlight:#eab308");
    expect(markup).not.toContain("/api/site-theme.css?");
  });
});
