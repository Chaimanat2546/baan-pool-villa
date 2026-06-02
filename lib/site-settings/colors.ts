import type { CSSProperties } from "react";

interface ThemeColorInput {
  accentColor: string;
  primaryColor: string;
}

type SiteThemeStyle = CSSProperties & Record<`--site-${string}`, string>;

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function mixHexColors(
  leftHex: string,
  rightHex: string,
  rightWeight: number,
): string {
  const left = hexToRgb(leftHex);
  const right = hexToRgb(rightHex);
  const weight = Math.min(1, Math.max(0, rightWeight));

  return rgbToHex(
    left[0] * (1 - weight) + right[0] * weight,
    left[1] * (1 - weight) + right[1] * weight,
    left[2] * (1 - weight) + right[2] * weight,
  );
}

function getRelativeLuminance(hex: string): number {
  const channels = hexToRgb(hex).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function getContrastRatio(
  foregroundHex: string,
  backgroundHex: string,
): number {
  const foreground = getRelativeLuminance(foregroundHex);
  const background = getRelativeLuminance(backgroundHex);
  const lighter = Math.max(foreground, background);
  const darker = Math.min(foreground, background);

  return (lighter + 0.05) / (darker + 0.05);
}

export function getReadableTextColor(
  backgroundHex: string,
): "#ffffff" | "#0f172a" {
  const lightText = "#ffffff";
  const darkText = "#0f172a";

  return getContrastRatio(lightText, backgroundHex) >
    getContrastRatio(darkText, backgroundHex)
    ? lightText
    : darkText;
}

function ensureReadableOnSurface(
  colorHex: string,
  surfaceHex = "#ffffff",
  minimumRatio = 4.5,
): string {
  if (getContrastRatio(colorHex, surfaceHex) >= minimumRatio) {
    return colorHex;
  }

  for (let weight = 0.04; weight <= 1; weight += 0.04) {
    const candidate = mixHexColors(colorHex, "#020617", weight);

    if (getContrastRatio(candidate, surfaceHex) >= minimumRatio) {
      return candidate;
    }
  }

  return "#020617";
}

export function buildSiteThemeStyle(input: ThemeColorInput): SiteThemeStyle {
  const primaryColor = ensureReadableOnSurface(input.primaryColor.toLowerCase());
  const accentColor = ensureReadableOnSurface(input.accentColor.toLowerCase());
  const textColor = mixHexColors(primaryColor, "#020617", 0.44);

  return {
    "--site-accent": accentColor,
    "--site-accent-hover": mixHexColors(accentColor, "#040000", 0.08),
    "--site-accent-soft": mixHexColors(accentColor, "#ffffff", 0.901),
    "--site-border": mixHexColors(primaryColor, "#e2e8f0", 0.85),
    "--site-border-strong": mixHexColors(primaryColor, "#94a3b8", 0.58),
    "--site-muted": mixHexColors(textColor, "#64748b", 0.58),
    "--site-on-accent": getReadableTextColor(accentColor),
    "--site-on-primary": getReadableTextColor(primaryColor),
    "--site-primary": primaryColor,
    "--site-primary-hover": mixHexColors(primaryColor, "#040000", 0.1),
    "--site-primary-soft": mixHexColors(primaryColor, "#faffff", 0.95),
    "--site-surface": "#ffffff",
    "--site-surface-soft": mixHexColors(primaryColor, "#ffffff", 0.97),
    "--site-surface-tint": mixHexColors(primaryColor, "#ffffff", 0.92),
    "--site-text": textColor,
  };
}
