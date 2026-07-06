export const SITE_LOGO_BACKGROUNDS = [
  "white",
  "transparent",
  "primary",
  "soft",
] as const;

export type SiteLogoBackground = (typeof SITE_LOGO_BACKGROUNDS)[number];

export const SITE_LOGO_BACKGROUND_LABELS: Record<SiteLogoBackground, string> = {
  primary: "สีหลัก",
  soft: "สีอ่อน",
  transparent: "โปร่งใส",
  white: "ขาว",
};

export const SITE_LOGO_BACKGROUND_CLASSES: Record<SiteLogoBackground, string> = {
  primary: "bg-[var(--site-primary)]",
  soft: "bg-[var(--site-primary-soft)]",
  transparent: "bg-transparent",
  white: "bg-white",
};

export function isSiteLogoBackground(
  value: string,
): value is SiteLogoBackground {
  return SITE_LOGO_BACKGROUNDS.includes(value as SiteLogoBackground);
}

export function normalizeSiteLogoBackground(
  value: string | null | undefined,
  fallback: SiteLogoBackground = "white",
): SiteLogoBackground {
  const normalizedValue = value?.trim().toLowerCase() ?? "";

  return isSiteLogoBackground(normalizedValue) ? normalizedValue : fallback;
}

