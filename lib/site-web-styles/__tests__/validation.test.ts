import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_WEB_STYLES } from "../defaults";
import {
  normalizeGalleryOptions,
  normalizeSiteWebStyles,
  validateWebStyleDraft,
} from "../validation";

describe("site web style validation", () => {
  it("uses safe defaults when rows are missing", () => {
    expect(normalizeSiteWebStyles([])).toEqual(DEFAULT_SITE_WEB_STYLES);
  });

  it("normalizes the three supported style rows", () => {
    expect(
      normalizeSiteWebStyles([
        {
          options: {},
          style_type: "header",
          style_variant: "right-booking",
        },
        {
          options: {
            backgroundColor: "#ffffff",
            textColor: "#111111",
          },
          style_type: "gallery",
          style_variant: "categorized-grid",
        },
        {
          options: {},
          style_type: "house_card",
          style_variant: "gallery",
        },
      ]),
    ).toEqual({
      gallery: {
        backgroundColor: "#ffffff",
        categoryOrder: [
          "cover",
          "outside",
          "pool",
          "inside",
          "livingroom",
          "bedroom",
          "kitchen",
          "bathroom",
          "parking",
          "review",
          "uncategorized",
        ],
        textColor: "#111111",
        variant: "categorized-grid",
      },
      header: { variant: "right-booking" },
      houseCard: { variant: "gallery" },
    });
  });

  it("removes cleared and invalid Gallery colors", () => {
    expect(
      normalizeGalleryOptions({
        backgroundColor: "",
        textColor: null,
      }),
    ).toEqual({});
    expect(normalizeGalleryOptions({ backgroundColor: "red" })).toEqual({});
  });

  it("keeps a valid global gallery category order and rejects an incomplete order", () => {
    expect(
      normalizeSiteWebStyles([
        {
          options: {
            categoryOrder: [
              "pool",
              "cover",
              "outside",
              "inside",
              "livingroom",
              "bedroom",
              "kitchen",
              "bathroom",
              "parking",
              "review",
              "uncategorized",
            ],
          },
          style_type: "gallery",
          style_variant: "categorized-grid",
        },
      ]).gallery.categoryOrder,
    ).toEqual([
      "pool",
      "cover",
      "outside",
      "inside",
      "livingroom",
      "bedroom",
      "kitchen",
      "bathroom",
      "parking",
      "review",
      "uncategorized",
    ]);

    expect(
      validateWebStyleDraft("gallery", {
        categoryOrder: ["cover", "outside"],
        variant: "categorized-grid",
      }),
    ).toEqual(["categoryOrder must contain every gallery category exactly once."]);
  });

  it("rejects unknown fields and malformed Gallery colors", () => {
    expect(
      validateWebStyleDraft("gallery", {
        backgroundColor: "red",
        extra: true,
        variant: "categorized-grid",
      }),
    ).toEqual([
      "Invalid gallery style fields.",
      "backgroundColor must be a six-digit hex color.",
    ]);
  });

  it("rejects variants that do not belong to the selected style type", () => {
    expect(validateWebStyleDraft("header", { variant: "gallery" })).toEqual([
      "Invalid header style variant.",
    ]);
    expect(validateWebStyleDraft("house_card", { variant: "lightbox" })).toEqual([
      "Invalid house card style variant.",
    ]);
  });
});
