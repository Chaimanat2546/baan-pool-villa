import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_HEADER_SETTINGS } from "../defaults";
import {
  normalizeDesktopHeaderVariant,
  validateDesktopHeaderVariant,
} from "../validation";

describe("desktop header variant", () => {
  it("accepts the two supported saved variants", () => {
    expect(normalizeDesktopHeaderVariant("centered-contact")).toBe(
      "centered-contact",
    );
    expect(normalizeDesktopHeaderVariant("right-booking")).toBe(
      "right-booking",
    );
  });

  it("falls back safely for missing or invalid values", () => {
    expect(normalizeDesktopHeaderVariant(null)).toBe(
      DEFAULT_SITE_HEADER_SETTINGS.desktopHeaderVariant,
    );
    expect(normalizeDesktopHeaderVariant("legacy-header")).toBe(
      DEFAULT_SITE_HEADER_SETTINGS.desktopHeaderVariant,
    );
    expect(validateDesktopHeaderVariant("legacy-header")).toEqual([
      "Invalid desktop header variant.",
    ]);
  });
});
