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
    expect(getReadableTextColor("#f8fbf7")).toBe("#0f172a");
  });
});

describe("buildSiteThemeStyle", () => {
  it("builds CSS variables from primary and accent colors", () => {
    expect(
      buildSiteThemeStyle({
        primaryColor: "#064e3b",
        accentColor: "#eab308",
      }),
    ).toEqual({
      "--site-accent": "#eab308",
      "--site-accent-soft": "#fdf7e7",
      "--site-on-primary": "#ffffff",
      "--site-primary": "#064e3b",
      "--site-primary-hover": "#064635",
      "--site-primary-soft": "#eef6f5",
    });
  });
});
