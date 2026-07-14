import { DEFAULT_SITE_HEADER_SETTINGS } from "./defaults";
import {
  DESKTOP_HEADER_VARIANTS,
  type DesktopHeaderVariant,
} from "./types";

export function normalizeDesktopHeaderVariant(
  value: unknown,
): DesktopHeaderVariant {
  return DESKTOP_HEADER_VARIANTS.includes(value as DesktopHeaderVariant)
    ? (value as DesktopHeaderVariant)
    : DEFAULT_SITE_HEADER_SETTINGS.desktopHeaderVariant;
}

export function validateDesktopHeaderVariant(value: unknown): string[] {
  return DESKTOP_HEADER_VARIANTS.includes(value as DesktopHeaderVariant)
    ? []
    : ["Invalid desktop header variant."];
}
