import { beforeEach, describe, expect, it, vi } from "vitest";

import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { SITE_SETTINGS_ID } from "@/lib/site-settings/defaults";
import { createHomeConfigClient } from "@/lib/site-settings/supabase";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getSiteSeoSettingsProjection } from "../server";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn: unknown) => fn),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: vi.fn((fn: unknown) => fn),
}));

vi.mock("@/lib/site-settings/supabase", () => ({
  createHomeConfigClient: vi.fn(),
}));

const createHomeConfigClientMock = vi.mocked(createHomeConfigClient);

function mockSeoQueries({
  legacy,
  rows,
}: {
  legacy: Error | { data: unknown; error: unknown };
  rows: Error | { data: unknown; error: unknown };
}) {
  const legacyMaybeSingle = vi.fn(
    legacy instanceof Error
      ? () => Promise.reject(legacy)
      : () => Promise.resolve(legacy),
  );
  const legacyEq = vi.fn().mockReturnValue({ maybeSingle: legacyMaybeSingle });
  const legacySelect = vi.fn().mockReturnValue({ eq: legacyEq });
  const seoSelect = vi.fn(
    rows instanceof Error
      ? () => Promise.reject(rows)
      : () => Promise.resolve(rows),
  );
  const from = vi.fn((table: string) => ({
    select: table === "site_seo_settings" ? seoSelect : legacySelect,
  }));

  createHomeConfigClientMock.mockReturnValue({ from } as never);

  return { from, legacyEq, legacyMaybeSingle, legacySelect, seoSelect };
}

describe("getSiteSeoSettingsProjection", () => {
  beforeEach(() => {
    createHomeConfigClientMock.mockClear();
  });

  it("loads and maps the bounded SEO rows through the dedicated cache", async () => {
    const query = mockSeoQueries({
      legacy: { data: null, error: null },
      rows: {
        data: [
          { page_type: "global", settings: { title: "Home" } },
          { page_type: "search", settings: { title: "Search" } },
        ],
        error: null,
      },
    });

    await expect(getSiteSeoSettingsProjection()).resolves.toMatchObject({
      seo_title: "Home",
      search_seo_title: "Search",
    });
    expect(query.from).toHaveBeenCalledWith("site_seo_settings");
    expect(query.seoSelect).toHaveBeenCalledWith("page_type,settings");
    expect(unstable_cache).toHaveBeenCalledWith(
      expect.any(Function),
      [`${CACHE_TAGS.siteSeoSettings}:v1`],
      {
        revalidate: CACHE_REVALIDATE_SECONDS.siteSeoSettings,
        tags: [CACHE_TAGS.siteSeoSettings],
      },
    );
    expect(cache).toHaveBeenCalledWith(expect.any(Function));
  });

  it("falls back once to the 18 legacy SEO columns", async () => {
    const legacy = {
      seo_title: "Legacy Home",
      search_seo_title: "Legacy Search",
    };
    const query = mockSeoQueries({
      legacy: { data: legacy, error: null },
      rows: { data: null, error: { message: "table unavailable" } },
    });

    await expect(getSiteSeoSettingsProjection()).resolves.toEqual(legacy);
    expect(query.legacySelect).toHaveBeenCalledWith(
      "seo_title,seo_description,seo_keywords,seo_og_image_url,seo_og_image_alt,seo_business_name,seo_same_as_urls,search_seo_title,search_seo_description,search_seo_keywords,search_seo_og_image_url,search_seo_og_image_alt,guides_seo_title,guides_seo_description,guides_seo_keywords,guides_seo_og_image_url,guides_seo_og_image_alt,villa_detail_seo_keywords",
    );
    expect(query.legacyEq).toHaveBeenCalledWith("id", SITE_SETTINGS_ID);
    expect(createHomeConfigClientMock).toHaveBeenCalledTimes(2);
    expect(query.from.mock.calls.map(([table]) => table)).toEqual([
      "site_seo_settings",
      "site_settings",
    ]);
  });

  it("falls back to legacy SEO when the new-table query throws", async () => {
    const legacy = { seo_title: "Legacy after throw" };
    const query = mockSeoQueries({
      legacy: { data: legacy, error: null },
      rows: new Error("new table threw"),
    });

    await expect(getSiteSeoSettingsProjection()).resolves.toEqual(legacy);
    expect(createHomeConfigClientMock).toHaveBeenCalledTimes(2);
    expect(query.from.mock.calls.map(([table]) => table)).toEqual([
      "site_seo_settings",
      "site_settings",
    ]);
    expect(query.seoSelect).toHaveBeenCalledTimes(1);
    expect(query.legacyMaybeSingle).toHaveBeenCalledTimes(1);
  });

  it("returns null when both remote SEO shapes are unavailable", async () => {
    mockSeoQueries({
      legacy: { data: null, error: { message: "legacy unavailable" } },
      rows: { data: null, error: { message: "table unavailable" } },
    });

    await expect(getSiteSeoSettingsProjection()).resolves.toBeNull();
  });

  it("returns null when both remote SEO attempts throw", async () => {
    const query = mockSeoQueries({
      legacy: new Error("legacy threw"),
      rows: new Error("new table threw"),
    });

    await expect(getSiteSeoSettingsProjection()).resolves.toBeNull();
    expect(createHomeConfigClientMock).toHaveBeenCalledTimes(2);
    expect(query.from.mock.calls.map(([table]) => table)).toEqual([
      "site_seo_settings",
      "site_settings",
    ]);
  });
});
