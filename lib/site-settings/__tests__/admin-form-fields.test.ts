import { describe, expect, it } from "vitest";

import {
  getOptionalUpload,
  readStringArrayField,
  readStringField,
} from "../admin-form-fields";

describe("admin site settings form fields", () => {
  it("reads string and list fields from multipart form data", () => {
    const formData = new FormData();

    formData.set("siteName", " Baan Pool Villa ");
    formData.set("seoKeywords", JSON.stringify([" pool villa ", 42, "pattaya"]));
    formData.set("sameAs", "https://example.com\r\nhttps://line.me/foo, ");

    expect(readStringField(formData, "siteName")).toBe(" Baan Pool Villa ");
    expect(readStringField(formData, "missing")).toBe("");
    expect(readStringArrayField(formData, "seoKeywords")).toEqual([
      "pool villa",
      "pattaya",
    ]);
    expect(readStringArrayField(formData, "sameAs")).toEqual([
      "https://example.com",
      "https://line.me/foo",
    ]);
  });

  it("reads optional upload fields safely", () => {
    const formData = new FormData();
    const logo = new File(["logo"], "logo.webp", { type: "image/webp" });

    formData.set("logo", logo);
    formData.set("hero", new File([], "empty.webp", { type: "image/webp" }));

    expect(getOptionalUpload(formData, "logo")).toBe(logo);
    expect(getOptionalUpload(formData, "hero")).toBeNull();
  });
});
