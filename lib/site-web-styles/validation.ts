import { cloneDefaultSiteWebStyles } from "./defaults";
import { isGalleryCategoryOrder } from "./gallery-categories";
import type {
  GalleryStyleOptions,
  SiteWebStyleRow,
  SiteWebStyles,
  WebStyleType,
} from "./types";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const HEADER_VARIANTS = new Set(["centered-contact", "right-booking"]);
const GALLERY_VARIANTS = new Set(["lightbox", "categorized-grid"]);
const GALLERY_IMAGE_SOURCES = new Set(["standard", "system"]);
const HOUSE_CARD_VARIANTS = new Set(["classic", "gallery"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

export function normalizeGalleryOptions(value: unknown): GalleryStyleOptions {
  if (!isRecord(value)) return {};

  return {
    ...(isHexColor(value.backgroundColor)
      ? { backgroundColor: value.backgroundColor }
      : {}),
    ...(isHexColor(value.textColor) ? { textColor: value.textColor } : {}),
    ...(isGalleryCategoryOrder(value.categoryOrder)
      ? { categoryOrder: [...value.categoryOrder] }
      : {}),
    ...(GALLERY_IMAGE_SOURCES.has(String(value.imageSource))
      ? { imageSource: value.imageSource as GalleryStyleOptions["imageSource"] }
      : {}),
    ...(typeof value.showCover === "boolean" ? { showCover: value.showCover } : {}),
  };
}

export function normalizeSiteWebStyles(rows: unknown): SiteWebStyles {
  const styles = cloneDefaultSiteWebStyles();
  if (!Array.isArray(rows)) return styles;

  for (const row of rows as SiteWebStyleRow[]) {
    if (row.style_type === "header" && HEADER_VARIANTS.has(String(row.style_variant))) {
      styles.header.variant = row.style_variant as SiteWebStyles["header"]["variant"];
    } else if (
      row.style_type === "gallery" &&
      GALLERY_VARIANTS.has(String(row.style_variant))
    ) {
      styles.gallery = {
        ...styles.gallery,
        ...normalizeGalleryOptions(row.options),
        variant: row.style_variant as SiteWebStyles["gallery"]["variant"],
      };
    } else if (
      row.style_type === "house_card" &&
      HOUSE_CARD_VARIANTS.has(String(row.style_variant))
    ) {
      styles.houseCard.variant = row.style_variant as SiteWebStyles["houseCard"]["variant"];
    }
  }

  return styles;
}

export function getResolvedWebStyle(type: WebStyleType, row: unknown) {
  const styles = normalizeSiteWebStyles(row ? [row] : []);
  return type === "house_card" ? styles.houseCard : styles[type];
}

export function validateWebStyleDraft(
  type: WebStyleType,
  value: unknown,
): string[] {
  if (!isRecord(value)) return ["Invalid web style request body."];

  const allowedKeys =
    type === "gallery"
      ? new Set(["variant", "backgroundColor", "categoryOrder", "imageSource", "showCover", "textColor"])
      : new Set(["variant"]);
  const errors: string[] = [];

  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    errors.push(`Invalid ${type === "house_card" ? "house card" : type} style fields.`);
  }

  const variants =
    type === "header"
      ? HEADER_VARIANTS
      : type === "gallery"
        ? GALLERY_VARIANTS
        : HOUSE_CARD_VARIANTS;
  if (!variants.has(String(value.variant))) {
    errors.push(`Invalid ${type === "house_card" ? "house card" : type} style variant.`);
  }

  if (type === "gallery") {
    for (const key of ["backgroundColor", "textColor"] as const) {
      const color = value[key];
      if (color !== undefined && color !== null && color !== "" && !isHexColor(color)) {
        errors.push(`${key} must be a six-digit hex color.`);
      }
    }
    if (
      value.categoryOrder !== undefined &&
      !isGalleryCategoryOrder(value.categoryOrder)
    ) {
      errors.push("categoryOrder must contain every gallery category exactly once.");
    }
    if (value.showCover !== undefined && typeof value.showCover !== "boolean") {
      errors.push("showCover must be a boolean.");
    }
    if (
      value.imageSource !== undefined &&
      !GALLERY_IMAGE_SOURCES.has(String(value.imageSource))
    ) {
      errors.push("imageSource must be standard or system.");
    }
  }

  return errors;
}

export function normalizeWebStyleDraft(
  type: WebStyleType,
  value: Record<string, unknown>,
) {
  return {
    options: type === "gallery" ? normalizeGalleryOptions(value) : {},
    style_type: type,
    style_variant: String(value.variant),
  };
}
