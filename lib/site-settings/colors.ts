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

export function getReadableTextColor(
  backgroundHex: string,
): "#ffffff" | "#0f172a" {
  return getRelativeLuminance(backgroundHex) > 0.55 ? "#0f172a" : "#ffffff";
}

export function buildSiteThemeStyle(input: ThemeColorInput): SiteThemeStyle {
  const primaryColor = input.primaryColor.toLowerCase();
  const accentColor = input.accentColor.toLowerCase();

  return {
    "--site-accent": accentColor,
    "--site-accent-soft": mixHexColors(accentColor, "#ffffff", 0.901),
    "--site-on-primary": getReadableTextColor(primaryColor),
    "--site-primary": primaryColor,
    "--site-primary-hover": mixHexColors(primaryColor, "#040000", 0.1),
    "--site-primary-soft": mixHexColors(primaryColor, "#faffff", 0.95),
  };
}
