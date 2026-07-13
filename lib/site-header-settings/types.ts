export const DESKTOP_HEADER_VARIANTS = [
  "centered-contact",
  "right-booking",
] as const;

export type DesktopHeaderVariant = (typeof DESKTOP_HEADER_VARIANTS)[number];

export interface SiteHeaderSettings {
  desktopHeaderVariant: DesktopHeaderVariant;
}
