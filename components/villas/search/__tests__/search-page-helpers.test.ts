import { describe, expect, it } from "vitest";

import {
  getSearchConditionLabels,
  getSearchErrorMessage,
  getSortKeyFromSearchParams,
  isAbortError,
  isVillaSortKey,
  readSearchCatalogPayload,
} from "../search-page-helpers";
import type { VillaFilters } from "@/lib/villas/types";

const filters: VillaFilters = {
  amenities: ["billard"],
  bedrooms: 3,
  guests: 8,
  maxPrice: 15000,
  nearSeaOnly: true,
  zone: "jomtien",
};

describe("search page helpers", () => {
  it("normalizes errors and sort keys for the search page", async () => {
    expect(getSearchErrorMessage(new Error("Unable to load houses (500)"))).toContain(
      "ไม่สามารถโหลด",
    );
    expect(getSearchErrorMessage(new Error("Custom failure"))).toBe("Custom failure");
    expect(isAbortError(new DOMException("aborted", "AbortError"))).toBe(true);
    expect(isVillaSortKey("price_desc")).toBe(true);
    expect(isVillaSortKey("nope")).toBe(false);
    expect(getSortKeyFromSearchParams(new URLSearchParams("sort=people_desc"))).toBe(
      "people_desc",
    );
    expect(getSortKeyFromSearchParams(new URLSearchParams("sort=nope"))).toBe(
      "recommended",
    );
  });

  it("reads catalog payloads and builds condition labels", async () => {
    const payload = await readSearchCatalogPayload(
      Response.json({ items: [], total: 0 }),
    );

    expect(payload).toEqual({ items: [], total: 0 });
    await expect(
      readSearchCatalogPayload(
        new Response("oops", { headers: { "content-type": "text/plain" } }),
      ),
    ).rejects.toThrow("Invalid house list response content type");
    await expect(
      readSearchCatalogPayload(
        new Response("{ nope", { headers: { "content-type": "application/json" } }),
      ),
    ).rejects.toThrow("Invalid house list response JSON");

    const labels = getSearchConditionLabels(filters, [
      { label: "จอมเทียน", value: "jomtien" },
    ]);

    expect(labels).toContain("จอมเทียน");
    expect(labels.some((label) => label.includes("8"))).toBe(true);
    expect(labels.some((label) => label.includes("ใกล้ทะเล"))).toBe(true);
    expect(labels.some((label) => label.includes("โต๊ะพูล"))).toBe(true);
  });
});
