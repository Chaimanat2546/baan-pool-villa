import { describe, expect, it } from "vitest";

import {
  buildSiteThemeStyle,
  getContrastRatio,
  getReadableTextColor,
  mixHexColors,
} from "../colors";

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
      "--site-on-primary": "#ffffff",
      "--site-primary": "#064e3b",
      "--site-surface": "#ffffff",
    });
    expectContrast(style["--site-accent"], style["--site-surface"]);
    expectContrast(style["--site-on-accent"], style["--site-accent"]);
    expect(style["--site-accent-hover"]).not.toBe(style["--site-accent"]);
    expect(style["--site-border"]).not.toBe(style["--site-primary"]);
    expect(style["--site-border-strong"]).not.toBe(style["--site-primary"]);
    expect(style["--site-muted"]).not.toBe(style["--site-text"]);
    expect(style["--site-surface-soft"]).not.toBe(style["--site-surface"]);
    expect(style["--site-surface-tint"]).not.toBe(style["--site-surface"]);
    expect(style["--site-text"]).not.toBe(style["--site-primary"]);
  });

  it("keeps generated text tokens readable when users pick light brand colors", () => {
    const style = buildSiteThemeStyle({
      primaryColor: "#fff9a8",
      accentColor: "#bdf7ff",
    });

    expectContrast(style["--site-on-primary"], style["--site-primary"]);
    expectContrast(style["--site-on-accent"], style["--site-accent"]);
    expectContrast(style["--site-primary"], style["--site-surface"]);
    expectContrast(style["--site-accent"], style["--site-surface"]);
    expectContrast(style["--site-text"], style["--site-surface"]);
    expectContrast(style["--site-muted"], style["--site-surface"]);
  });

  it("keeps hover and soft tokens readable across saturated brand colors", () => {
    const style = buildSiteThemeStyle({
      primaryColor: "#ff1744",
      accentColor: "#00e676",
    });

    expectContrast(style["--site-on-primary"], style["--site-primary-hover"]);
    expectContrast(style["--site-on-accent"], style["--site-accent-hover"]);
    expectContrast(style["--site-primary"], style["--site-primary-soft"], 3);
    expectContrast(style["--site-accent"], style["--site-accent-soft"], 3);
  });

  it("normalizes white brand colors into usable action tokens", () => {
    const style = buildSiteThemeStyle({
      primaryColor: "#ffffff",
      accentColor: "#ffffff",
    });

    expect(style["--site-primary"]).not.toBe("#ffffff");
    expect(style["--site-accent"]).not.toBe("#ffffff");
    expectContrast(style["--site-on-primary"], style["--site-primary"]);
    expectContrast(style["--site-on-primary"], style["--site-primary-hover"]);
    expectContrast(style["--site-on-accent"], style["--site-accent"]);
    expectContrast(style["--site-on-accent"], style["--site-accent-hover"]);
  });
});
