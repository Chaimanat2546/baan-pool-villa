import { describe, expect, it } from "vitest";

import {
  buildSiteThemeCss,
  buildSiteThemeStylesheetHref,
  buildSiteThemeStyle,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_HIGHLIGHT_COLOR,
  DEFAULT_LINK_COLOR,
  DEFAULT_PRIMARY_COLOR,
  getContrastRatio,
  getReadableTextColor,
  mixHexColors,
} from "../colors";
import { DEFAULT_SITE_SETTINGS } from "../defaults";

function expectContrast(
  foreground: string,
  background: string,
  minimumRatio = 4.5,
) {
  expect(getContrastRatio(foreground, background)).toBeGreaterThanOrEqual(
    minimumRatio,
  );
}

describe("mixHexColors", () => {
  it("mixes two hex colors", () => {
    expect(mixHexColors("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});

describe("theme fallback constants", () => {
  it("match production-safe site setting defaults", () => {
    expect(DEFAULT_PRIMARY_COLOR).toBe(DEFAULT_SITE_SETTINGS.primaryColor);
    expect(DEFAULT_ACCENT_COLOR).toBe(DEFAULT_SITE_SETTINGS.accentColor);
    expect(DEFAULT_LINK_COLOR).toBe(DEFAULT_SITE_SETTINGS.headerLinkColor);
    expect(DEFAULT_LINK_COLOR).toBe(DEFAULT_SITE_SETTINGS.footerLinkColor);
    expect(DEFAULT_HIGHLIGHT_COLOR).toBe(
      DEFAULT_SITE_SETTINGS.headerLinkHoverColor,
    );
    expect(DEFAULT_HIGHLIGHT_COLOR).toBe(
      DEFAULT_SITE_SETTINGS.footerLinkHoverColor,
    );
    expect(DEFAULT_HIGHLIGHT_COLOR).toBe(
      DEFAULT_SITE_SETTINGS.bankHighlightColor,
    );
    expect(DEFAULT_HIGHLIGHT_COLOR).toBe(
      DEFAULT_SITE_SETTINGS.bankAccountHighlightColor,
    );
    expect(DEFAULT_HIGHLIGHT_COLOR).toBe(
      DEFAULT_SITE_SETTINGS.bankNameHighlightColor,
    );
    expect(DEFAULT_HIGHLIGHT_COLOR).toBe(
      DEFAULT_SITE_SETTINGS.bankNumberHighlightColor,
    );
  });
});

describe("getReadableTextColor", () => {
  it("uses white on dark colors and dark text on light colors", () => {
    expect(getReadableTextColor("#064e3b")).toBe("#ffffff");
    expect(getReadableTextColor("#eab308")).toBe("#0f172a");
    expect(getReadableTextColor("#f8fbf7")).toBe("#0f172a");
  });

  it("chooses the highest contrast text color for risky brand colors", () => {
    expect(getReadableTextColor("#ffff66")).toBe("#0f172a");
    expect(getReadableTextColor("#4f46e5")).toBe("#ffffff");
    expect(getReadableTextColor("#f8fafc")).toBe("#0f172a");
  });
});

describe("buildSiteThemeStyle", () => {
  it("builds semantic CSS variables from primary and accent colors", () => {
    const style = buildSiteThemeStyle({
      primaryColor: "#064e3b",
      accentColor: "#eab308",
    });

    expect(style).toMatchObject({
      "--site-bank-account-highlight": "#eab308",
      "--site-bank-highlight": "#eab308",
      "--site-bank-name-highlight": "#eab308",
      "--site-bank-number-highlight": "#eab308",
      "--site-footer-link": "#ffffff",
      "--site-footer-link-hover": "#eab308",
      "--site-header-link": "#ffffff",
      "--site-header-link-hover": "#eab308",
      "--site-on-primary": "#ffffff",
      "--site-primary": "#064e3b",
      "--site-surface": "#ffffff",
    });
    expectContrast(style["--site-accent-on-dark"], style["--site-primary"]);
    expectContrast(style["--site-on-accent"], style["--site-accent"]);
    expect(style["--site-primary-hover"]).toBe(style["--site-primary"]);
    expect(style["--site-accent-hover"]).toBe(style["--site-accent"]);
    expect(style["--site-border"]).not.toBe(style["--site-primary"]);
    expect(style["--site-border-strong"]).not.toBe(style["--site-primary"]);
    expect(style["--site-muted"]).not.toBe(style["--site-text"]);
    expect(style["--site-muted-text"]).toBe(style["--site-muted"]);
    expectContrast(style["--site-text"], style["--site-surface"]);
    expectContrast(style["--site-muted"], style["--site-surface"]);
    expectContrast(style["--site-on-primary"], style["--site-primary"]);
    expectContrast(style["--site-on-accent"], style["--site-accent"]);
    expect(style["--site-surface-soft"]).not.toBe(style["--site-surface"]);
    expect(style["--site-surface-tint"]).not.toBe(style["--site-surface"]);
    expect(style["--site-text"]).not.toBe(style["--site-primary"]);
    expect(style["--site-card-shadow"]).toBe(
      "0 14px 42px rgba(6, 78, 59, 0.09)",
    );
  });

  it("keeps on-color text readable when users pick light brand colors", () => {
    const style = buildSiteThemeStyle({
      primaryColor: "#fff9a8",
      accentColor: "#bdf7ff",
    });

    expectContrast(style["--site-on-primary"], style["--site-primary"]);
    expectContrast(style["--site-on-accent"], style["--site-accent"]);
    expectContrast(style["--site-accent-on-dark"], style["--site-primary"]);
  });

  it("preserves configured header, footer, and bank text colors", () => {
    const style = buildSiteThemeStyle({
      primaryColor: "#d1950b",
      accentColor: "#eab308",
      headerLinkColor: "#ffffff",
      headerLinkHoverColor: "#eab308",
      footerLinkColor: "#ffffff",
      footerLinkHoverColor: "#eab308",
      bankHighlightColor: "#eab308",
    });

    expect(style["--site-header-link"]).toBe("#ffffff");
    expect(style["--site-header-link-hover"]).toBe("#eab308");
    expect(style["--site-footer-link"]).toBe("#ffffff");
    expect(style["--site-footer-link-hover"]).toBe("#eab308");
    expect(style["--site-bank-account-highlight"]).toBe("#eab308");
    expect(style["--site-on-overlay"]).toBe("#f8fafc");
  });

  it("keeps separate configured bank highlight variables", () => {
    const style = buildSiteThemeStyle({
      primaryColor: "#064e3b",
      accentColor: "#eab308",
      bankHighlightColor: "#fde047",
      bankAccountHighlightColor: "#1d4ed8",
      bankNameHighlightColor: "#7c3aed",
      bankNumberHighlightColor: "#be123c",
    });

    expect(style["--site-bank-highlight"]).toBe("#fde047");
    expect(style["--site-bank-account-highlight"]).toBe("#1d4ed8");
    expect(style["--site-bank-name-highlight"]).toBe("#7c3aed");
    expect(style["--site-bank-number-highlight"]).toBe("#be123c");
  });

  it("keeps hover and soft tokens readable across saturated brand colors", () => {
    const style = buildSiteThemeStyle({
      primaryColor: "#ff1744",
      accentColor: "#00e676",
    });

    expectContrast(style["--site-on-primary"], style["--site-primary-hover"]);
    expectContrast(style["--site-on-accent"], style["--site-accent-hover"]);
    expectContrast(style["--site-accent-on-dark"], style["--site-primary"]);
    expect(style["--site-primary-soft"]).not.toBe(style["--site-primary"]);
    expect(style["--site-accent-soft"]).not.toBe(style["--site-accent"]);
  });

  it("preserves white brand colors as selected action tokens", () => {
    const style = buildSiteThemeStyle({
      primaryColor: "#ffffff",
      accentColor: "#ffffff",
    });

    expect(style["--site-primary"]).toBe("#ffffff");
    expect(style["--site-accent"]).toBe("#ffffff");
    expect(style["--site-primary-hover"]).toBe(style["--site-primary"]);
    expect(style["--site-accent-hover"]).toBe(style["--site-accent"]);
    expectContrast(style["--site-on-primary"], style["--site-primary"]);
    expectContrast(style["--site-on-accent"], style["--site-accent"]);
    expectContrast(style["--site-accent-on-dark"], style["--site-primary"]);
  });

  it("keeps accent text readable on solid primary backgrounds", () => {
    const style = buildSiteThemeStyle({
      primaryColor: "#064e3b",
      accentColor: "#0f766e",
    });

    expectContrast(style["--site-accent-on-dark"], style["--site-primary"]);
    expect(style["--site-accent-on-dark"]).not.toBe(style["--site-accent"]);
  });

  it("preserves each configured bank detail highlight exactly", () => {
    const style = buildSiteThemeStyle({
      primaryColor: "#fbae09",
      accentColor: "#08cde7",
      bankHighlightColor: "#005c00",
      bankAccountHighlightColor: "#005c00",
      bankNameHighlightColor: "#005c00",
      bankNumberHighlightColor: "#005c00",
    });

    expect(style["--site-bank-account-highlight"]).toBe("#005c00");
    expect(style["--site-bank-name-highlight"]).toBe("#005c00");
    expect(style["--site-bank-number-highlight"]).toBe("#005c00");
  });
});

describe("buildSiteThemeCss", () => {
  it("serializes theme variables under a scoped selector", () => {
    const css = buildSiteThemeCss(
      {
        primaryColor: "#064e3b",
        accentColor: "#eab308",
      },
      "settings-preview-theme",
    );

    expect(css).toContain(".settings-preview-theme{");
    expect(css).toContain("--site-primary:#064e3b");
    expect(css).toContain("--site-accent:");
    expect(css).toContain("--site-header-link:#ffffff");
    expect(css).toContain("--site-bank-highlight:#eab308");
    expect(css).toContain("--site-bank-account-highlight:#eab308");
    expect(css).toContain("--site-bank-name-highlight:#eab308");
    expect(css).toContain("--site-bank-number-highlight:#eab308");
  });

  it("falls back to the public theme scope for invalid selectors", () => {
    const css = buildSiteThemeCss(
      {
        primaryColor: "#064e3b",
        accentColor: "#eab308",
      },
      "x;body",
    );

    expect(css.startsWith(".site-theme{")).toBe(true);
  });

  it("serializes separate bank highlight variables", () => {
    const css = buildSiteThemeCss({
      primaryColor: "#064e3b",
      accentColor: "#eab308",
      bankHighlightColor: "#fde047",
      bankAccountHighlightColor: "#1d4ed8",
      bankNameHighlightColor: "#7c3aed",
      bankNumberHighlightColor: "#be123c",
    });

    expect(css).toContain("--site-bank-highlight:");
    expect(css).toContain("--site-bank-account-highlight:");
    expect(css).toContain("--site-bank-name-highlight:");
    expect(css).toContain("--site-bank-number-highlight:");
    expect(css).toContain("--site-bank-account-highlight:#1d4ed8");
    expect(css).toContain("--site-bank-name-highlight:#7c3aed");
    expect(css).toContain("--site-bank-number-highlight:#be123c");
  });
});

describe("buildSiteThemeStylesheetHref", () => {
  it("builds the internal theme stylesheet URL", () => {
    expect(
      buildSiteThemeStylesheetHref(
        {
          primaryColor: "#064e3b",
          accentColor: "#eab308",
          headerLinkColor: "#f8fafc",
          headerLinkHoverColor: "#fde68a",
          footerLinkColor: "#e2e8f0",
          footerLinkHoverColor: "#facc15",
          bankHighlightColor: "#fde047",
          bankAccountHighlightColor: "#1d4ed8",
          bankNameHighlightColor: "#7c3aed",
          bankNumberHighlightColor: "#be123c",
        },
        "settings-preview-theme",
      ),
    ).toBe(
      "/api/site-theme.css?accent=eab308&bankHighlight=fde047&bankAccountHighlight=1d4ed8&bankNameHighlight=7c3aed&bankNumberHighlight=be123c&footerLink=e2e8f0&footerLinkHover=facc15&headerLink=f8fafc&headerLinkHover=fde68a&primary=064e3b&scope=settings-preview-theme",
    );
  });
});
