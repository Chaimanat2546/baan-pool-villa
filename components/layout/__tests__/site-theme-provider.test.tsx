import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";

import { SiteThemeProvider } from "../site-theme-provider";

describe("SiteThemeProvider", () => {
  it("loads scoped theme variables from a stylesheet instead of inline styles", () => {
    const markup = renderToStaticMarkup(
      <SiteThemeProvider settings={DEFAULT_SITE_SETTINGS}>
        <main>Content</main>
      </SiteThemeProvider>,
    );

    expect(markup).toContain('class="site-theme min-h-full"');
    expect(markup).toContain('rel="stylesheet"');
    expect(markup).toContain("/api/site-theme.css?");
    expect(markup).toContain("headerLink=ffffff");
    expect(markup).toContain("headerLinkHover=eab308");
    expect(markup).toContain("footerLink=ffffff");
    expect(markup).toContain("footerLinkHover=eab308");
    expect(markup).toContain("bankHighlight=eab308");
    expect(markup).not.toContain("style=");
  });
});
