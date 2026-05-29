import { describe, expect, it } from "vitest";

import {
  buildSiteThemeStyle,
  getReadableTextColor,
  mixHexColors,
} from "../colors";

describe("mixHexColors", () => {
  it("mixes two hex colors", () => {
    expect(mixHexColors("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});

describe("getReadableTextColor", () => {
  it("uses white on dark colors and dark text on light colors", () => {
    expect(getReadableTextColor("#064e3b")).toBe("#ffffff");
    expect(getReadableTextColor("#eab308")).toBe("#0f172a");
    expect(getReadableTextColor("#f8fbf7")).toBe("#0f172a");
  });
});

describe("buildSiteThemeStyle", () => {
  it("builds semantic CSS variables from primary and accent colors", () => {
    const style = buildSiteThemeStyle({
      primaryColor: "#064e3b",
      accentColor: "#eab308",
    });

    expect(style).toMatchObject({
      "--site-accent": "#eab308",
      "--site-on-accent": "#0f172a",
      "--site-on-primary": "#ffffff",
      "--site-primary": "#064e3b",
      "--site-surface": "#ffffff",
    });
    expect(style["--site-accent-hover"]).not.toBe(style["--site-accent"]);
    expect(style["--site-border"]).not.toBe(style["--site-primary"]);
    expect(style["--site-border-strong"]).not.toBe(style["--site-primary"]);
    expect(style["--site-muted"]).not.toBe(style["--site-text"]);
    expect(style["--site-surface-soft"]).not.toBe(style["--site-surface"]);
    expect(style["--site-surface-tint"]).not.toBe(style["--site-surface"]);
    expect(style["--site-text"]).not.toBe(style["--site-primary"]);
  });
});
