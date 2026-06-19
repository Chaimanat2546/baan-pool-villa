export const GUIDE_TEXT_COLOR_SWATCHES = [
  "#000000",
  "#404040",
  "#666666",
  "#808080",
  "#a6a6a6",
  "#bfbfbf",
  "#d9d9d9",
  "#f2f2f2",
  "#ffffff",
  "#c00000",
  "#ff0000",
  "#ffc000",
  "#ffff00",
  "#92d050",
  "#00b050",
  "#00b0f0",
  "#0070c0",
  "#002060",
  "#7030a0",
  "#ff00ff",
  "#f4cccc",
  "#fce5cd",
  "#fff2cc",
  "#d9ead3",
  "#d0e0e3",
  "#cfe2f3",
  "#d9d2e9",
  "#ead1dc",
  "#063f35",
  "#0f5a66",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#2563eb",
  "#7c3aed",
  "#c026d3",
  "#111827",
] as const;

export const DEFAULT_GUIDE_TEXT_COLOR = "#063f35";

function normalizeGuideTextColor(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const color = value.trim().toLowerCase();

  return GUIDE_TEXT_COLOR_SWATCHES.includes(
    color as (typeof GUIDE_TEXT_COLOR_SWATCHES)[number],
  )
    ? color
    : null;
}

export function getGuideTextColorClass(value: unknown): string | null {
  const color = normalizeGuideTextColor(value);

  return color ? `guide-text-color-${color.slice(1)}` : null;
}

export function getGuideTextColorSwatchClass(value: unknown): string | null {
  const color = normalizeGuideTextColor(value);

  return color ? `guide-color-swatch-${color.slice(1)}` : null;
}

export function normalizeGuideTextColorForStorage(
  value: unknown,
): string | null {
  return normalizeGuideTextColor(value);
}
