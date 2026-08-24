import type { CSSProperties } from "react";

interface ThemeColorInput {
  accentColor: string;
  bankAccountHighlightColor?: string;
  bankHighlightColor?: string;
  bankNameHighlightColor?: string;
  bankNumberHighlightColor?: string;
  footerLinkColor?: string;
  footerLinkHoverColor?: string;
  headerLinkColor?: string;
  headerLinkHoverColor?: string;
  primaryColor: string;
}

type SiteThemeStyle = CSSProperties & Record<`--site-${string}`, string>;

export const DEFAULT_PRIMARY_COLOR = "#064e3b";
export const DEFAULT_ACCENT_COLOR = "#eab308";
export const DEFAULT_LINK_COLOR = "#ffffff";
export const DEFAULT_HIGHLIGHT_COLOR = "#eab308";

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

/**
 * Blends two hex colors using the provided weight for the right-hand color.
 *
 * @param leftHex - The base color in `#RRGGBB` format.
 * @param rightHex - The mixed-in color in `#RRGGBB` format.
 * @param rightWeight - The blend weight applied to `rightHex`, clamped between `0` and `1`.
 * @returns The blended hex color in `#RRGGBB` format.
 */
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

/**
 * Calculates the WCAG contrast ratio between two hex colors.
 *
 * @param foregroundHex - The foreground color in `#RRGGBB` format.
 * @param backgroundHex - The background color in `#RRGGBB` format.
 * @returns The contrast ratio between the two colors.
 */
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

/**
 * Chooses the more readable text color for a given background.
 *
 * @param backgroundHex - The background color in `#RRGGBB` format.
 * @returns Either white or dark slate text, whichever has better contrast.
 */
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

function ensureReadableOnBackground(
  colorHex: string,
  backgroundHex: string,
  minimumRatio = 4.5,
): string {
  if (getContrastRatio(colorHex, backgroundHex) >= minimumRatio) {
    return colorHex;
  }

  const readableTarget = getReadableTextColor(backgroundHex);

  for (let weight = 0.04; weight <= 1; weight += 0.04) {
    const candidate = mixHexColors(colorHex, readableTarget, weight);

    if (getContrastRatio(candidate, backgroundHex) >= minimumRatio) {
      return candidate;
    }
  }

  return readableTarget;
}

/**
 * Builds the CSS custom properties derived from resolved site colors for the
 * shared theme layer.
 *
 * @param input - The resolved primary and accent colors.
 * @returns A CSS variable map with readable derived theme colors.
 */
export function buildSiteThemeStyle(input: ThemeColorInput): SiteThemeStyle {
  const primaryColor = input.primaryColor.toLowerCase();
  const accentColor = input.accentColor.toLowerCase();
  const bankHighlightColor = (
    input.bankHighlightColor ?? DEFAULT_HIGHLIGHT_COLOR
  ).toLowerCase();
  const bankAccountHighlightColor = (
    input.bankAccountHighlightColor ?? bankHighlightColor
  ).toLowerCase();
  const bankNameHighlightColor = (
    input.bankNameHighlightColor ?? bankHighlightColor
  ).toLowerCase();
  const bankNumberHighlightColor = (
    input.bankNumberHighlightColor ?? bankHighlightColor
  ).toLowerCase();
  const footerLinkColor = (input.footerLinkColor ?? DEFAULT_LINK_COLOR).toLowerCase();
  const footerLinkHoverColor = (
    input.footerLinkHoverColor ?? DEFAULT_HIGHLIGHT_COLOR
  ).toLowerCase();
  const headerLinkColor = (input.headerLinkColor ?? DEFAULT_LINK_COLOR).toLowerCase();
  const headerLinkHoverColor = (
    input.headerLinkHoverColor ?? DEFAULT_HIGHLIGHT_COLOR
  ).toLowerCase();
  const [shadowRed, shadowGreen, shadowBlue] = hexToRgb(primaryColor);
  const accentOnDarkColor = ensureReadableOnBackground(
    accentColor,
    primaryColor,
  );
  const textColor = mixHexColors(primaryColor, "#020617", 0.44);
  const mutedTextColor = mixHexColors(textColor, "#64748b", 0.58);

  return {
    "--site-accent": accentColor,
    "--site-accent-hover": accentColor,
    "--site-accent-on-dark": accentOnDarkColor,
    "--site-accent-soft": mixHexColors(accentColor, "#ffffff", 0.901),
    "--site-bank-account-highlight": bankAccountHighlightColor,
    "--site-bank-highlight": bankHighlightColor,
    "--site-bank-name-highlight": bankNameHighlightColor,
    "--site-bank-number-highlight": bankNumberHighlightColor,
    "--site-border": mixHexColors(primaryColor, "#e2e8f0", 0.85),
    "--site-border-strong": mixHexColors(primaryColor, "#94a3b8", 0.58),
    "--site-card-shadow": `0 14px 42px rgba(${shadowRed}, ${shadowGreen}, ${shadowBlue}, 0.09)`,
    "--site-footer-link": footerLinkColor,
    "--site-footer-link-hover": footerLinkHoverColor,
    "--site-header-link": headerLinkColor,
    "--site-header-link-hover": headerLinkHoverColor,
    "--site-muted": mutedTextColor,
    "--site-muted-text": mutedTextColor,
    "--site-on-accent": getReadableTextColor(accentColor),
    "--site-on-overlay": "#f8fafc",
    "--site-on-primary": getReadableTextColor(primaryColor),
    "--site-primary": primaryColor,
    "--site-primary-hover": primaryColor,
    "--site-primary-soft": mixHexColors(primaryColor, "#faffff", 0.95),
    "--site-surface": "#ffffff",
    "--site-surface-soft": mixHexColors(primaryColor, "#ffffff", 0.97),
    "--site-surface-tint": mixHexColors(primaryColor, "#ffffff", 0.92),
    "--site-text": textColor,
  };
}

function normalizeCssScope(scope: string): string {
  return /^[a-z][a-z0-9-]{0,39}$/.test(scope) ? scope : "site-theme";
}

function formatThemeColorParam(color: string): string {
  const normalized = color.trim().toLowerCase();

  return normalized.startsWith("#") ? normalized.slice(1) : normalized;
}

export function buildSiteThemeCss(
  input: ThemeColorInput,
  scope = "site-theme",
): string {
  const style = buildSiteThemeStyle(input);
  const declarations = Object.entries(style)
    .map(([property, value]) => `${property}:${value}`)
    .join(";");

  return `.${normalizeCssScope(scope)}{${declarations}}`;
}

export function buildSiteThemeStylesheetHref(
  input: ThemeColorInput,
  scope = "site-theme",
): string {
  const params = new URLSearchParams({
    accent: formatThemeColorParam(input.accentColor),
    bankHighlight: formatThemeColorParam(
      input.bankHighlightColor ?? DEFAULT_HIGHLIGHT_COLOR,
    ),
    bankAccountHighlight: formatThemeColorParam(
      input.bankAccountHighlightColor ??
        input.bankHighlightColor ??
        DEFAULT_HIGHLIGHT_COLOR,
    ),
    bankNameHighlight: formatThemeColorParam(
      input.bankNameHighlightColor ??
        input.bankHighlightColor ??
        DEFAULT_HIGHLIGHT_COLOR,
    ),
    bankNumberHighlight: formatThemeColorParam(
      input.bankNumberHighlightColor ??
        input.bankHighlightColor ??
        DEFAULT_HIGHLIGHT_COLOR,
    ),
    footerLink: formatThemeColorParam(input.footerLinkColor ?? DEFAULT_LINK_COLOR),
    footerLinkHover: formatThemeColorParam(
      input.footerLinkHoverColor ?? DEFAULT_HIGHLIGHT_COLOR,
    ),
    headerLink: formatThemeColorParam(input.headerLinkColor ?? DEFAULT_LINK_COLOR),
    headerLinkHover: formatThemeColorParam(
      input.headerLinkHoverColor ?? DEFAULT_HIGHLIGHT_COLOR,
    ),
    primary: formatThemeColorParam(input.primaryColor),
    scope: normalizeCssScope(scope),
  });

  return `/api/site-theme.css?${params.toString()}`;
}
