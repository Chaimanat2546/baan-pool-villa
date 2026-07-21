import { beforeEach, describe, expect, it, vi } from "vitest";

import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { DEFAULT_DETAIL_LAYOUT } from "../../detail-layout/defaults";
import { DEFAULT_SITE_SETTINGS, SITE_SETTINGS_ID } from "../defaults";
import { getSiteSettings } from "../server";
import { createHomeConfigClient } from "../supabase";
import { unstable_cache } from "next/cache";
import { cache } from "react";

const { getSiteSeoSettingsProjectionMock } = vi.hoisted(() => ({
  getSiteSeoSettingsProjectionMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn: unknown) => fn),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: vi.fn((fn: unknown) => fn),
}));

vi.mock("../supabase", () => ({
  createHomeConfigClient: vi.fn(),
}));

vi.mock("@/lib/site-seo-settings/server", () => ({
  getSiteSeoSettingsProjection: getSiteSeoSettingsProjectionMock,
}));

const createHomeConfigClientMock = vi.mocked(createHomeConfigClient);
const unstableCacheMock = vi.mocked(unstable_cache);
const cacheMock = vi.mocked(cache);

function mockSiteSettingsQuery(result: {
  data: unknown;
  error: unknown;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  createHomeConfigClientMock.mockReturnValue({
    from,
  } as ReturnType<typeof createHomeConfigClient>);

  return { eq, from, maybeSingle, select };
}

function mockSiteSettingsQueryQueue(
  results: { data: unknown; error: unknown }[],
) {
  const queries = results.map((result) => {
    const maybeSingle = vi.fn().mockResolvedValue(result);
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });

    return { eq, maybeSingle, select };
  });
  const from = vi.fn().mockImplementation(() => {
    const query = queries.shift();

    if (!query) {
      throw new Error("Unexpected site_settings query");
    }

    return query;
  });

  createHomeConfigClientMock.mockReturnValue({
    from,
  } as ReturnType<typeof createHomeConfigClient>);

  return { from };
}

describe("getSiteSettings", () => {
  beforeEach(() => {
    getSiteSeoSettingsProjectionMock.mockReset();
    getSiteSeoSettingsProjectionMock.mockResolvedValue(null);
  });

  it("wraps the Supabase site settings read in a tagged Next cache", async () => {
    mockSiteSettingsQuery({ data: null, error: null });

    await getSiteSettings();

    expect(unstableCacheMock).toHaveBeenCalledWith(
      expect.any(Function),
      [`${CACHE_TAGS.siteSettings}:v5`],
      {
        revalidate: CACHE_REVALIDATE_SECONDS.siteSettings,
        tags: [CACHE_TAGS.siteSettings],
      },
    );
  });

  it("memoizes the resolved settings for a server render", () => {
    expect(cacheMock).toHaveBeenCalledWith(expect.any(Function));
  });

  it("returns normalized settings from the config table", async () => {
    const query = mockSiteSettingsQuery({
      data: {
        id: SITE_SETTINGS_ID,
        site_name: " Baan Pool Villa ",
        primary_color: "#123456",
        accent_color: "#abcdef",
        logo_image_path: "logo/2026/05/logo.webp",
        logo_image_url:
          "https://example.supabase.co/storage/v1/object/public/site-assets/logo/2026/05/logo.webp",
        hero_image_path: "hero/2026/05/hero.webp",
        hero_image_url:
          "https://example.supabase.co/storage/v1/object/public/site-assets/hero/2026/05/hero.webp",
        hero_image_alt: "Pool villas",
        bank_account_name: " คุณ อาภัสรา จินดาวา ",
        bank_name: " ธนาคารกสิกรไทย ",
        bank_account_number: " 398-289-7482 ",
        phone_contacts: [
          {
            name: " คุณเกม ",
            phone: " 0617485213 ",
            time: " ช่วง 07.00-15.00 ",
          },
        ],
        messenger_url: " https://www.facebook.com/baanpoolvillas ",
        line_id: " @baanpoolvilla ",
        line_url: " https://line.me/R/ti/p/@baanpoolvilla ",
        detail_layout: DEFAULT_DETAIL_LAYOUT,
        tiktok_account_url: " https://www.tiktok.com/@baanpoolvilla ",
        tiktok_video_urls: [
          "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001?lang=th-TH",
          "https://www.tiktok.com/player/v1/7370000000000000002",
        ],
      },
      error: null,
    });

    await expect(getSiteSettings()).resolves.toMatchObject({
      degraded: true,
      settings: {
        siteName: "Baan Pool Villa",
        primaryColor: "#123456",
        accentColor: "#abcdef",
        logoImage: {
          path: "logo/2026/05/logo.webp",
          url: "https://example.supabase.co/storage/v1/object/public/site-assets/logo/2026/05/logo.webp",
          alt: "Baan Pool Villa logo",
        },
        heroImage: {
          path: "hero/2026/05/hero.webp",
          url: "https://example.supabase.co/storage/v1/object/public/site-assets/hero/2026/05/hero.webp",
          alt: "Pool villas",
        },
        seo: DEFAULT_SITE_SETTINGS.seo,
        pageSeo: DEFAULT_SITE_SETTINGS.pageSeo,
        tiktok: {
          accountUrl: "https://www.tiktok.com/@baanpoolvilla",
          videos: [
            {
              url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001?lang=th-TH",
              videoId: "7370000000000000001",
            },
            {
              url: "https://www.tiktok.com/player/v1/7370000000000000002",
              videoId: "7370000000000000002",
            },
          ],
        },
        detailLayout: DEFAULT_DETAIL_LAYOUT,
      },
      source: "config",
    });
    expect(query.select).toHaveBeenCalledWith(
      expect.stringContaining("tiktok_account_url"),
    );
    expect(query.select).toHaveBeenCalledWith(
      expect.stringContaining("tiktok_video_urls"),
    );
    expect(query.select).toHaveBeenCalledWith(
      expect.stringContaining("google_tag_manager_id"),
    );
    expect(query.select).toHaveBeenCalledWith(
      expect.not.stringContaining("seo_title"),
    );
    expect(query.select).toHaveBeenCalledWith(
      expect.not.stringContaining("bank_account_name"),
    );
    expect(query.select).toHaveBeenCalledWith(
      expect.not.stringContaining("phone_contacts"),
    );
    expect(query.from).toHaveBeenCalledWith("site_settings");
    expect(query.eq).toHaveBeenCalledWith("id", SITE_SETTINGS_ID);
  });

  it("replaces only SEO settings when the dedicated projection exists", async () => {
    getSiteSeoSettingsProjectionMock.mockResolvedValue({
      seo_title: "Dedicated SEO",
      search_seo_title: "Dedicated Search SEO",
    });
    mockSiteSettingsQuery({
      data: {
        id: SITE_SETTINGS_ID,
        site_name: "Remote Brand",
        primary_color: "#123456",
        accent_color: "#abcdef",
      },
      error: null,
    });

    await expect(getSiteSettings()).resolves.toMatchObject({
      settings: {
        siteName: "Remote Brand",
        primaryColor: "#123456",
        seo: { title: "Dedicated SEO" },
        pageSeo: { search: { title: "Dedicated Search SEO" } },
      },
      source: "config",
    });
  });

  it("keeps valid base settings when the SEO projection rejects", async () => {
    getSiteSeoSettingsProjectionMock.mockRejectedValue(
      new Error("SEO cache unavailable"),
    );
    mockSiteSettingsQuery({
      data: {
        id: SITE_SETTINGS_ID,
        site_name: "Remote Brand",
        primary_color: "#123456",
        accent_color: "#abcdef",
        bank_account_name: "Remote Account",
        messenger_url: "https://www.facebook.com/baanpoolvillas",
      },
      error: null,
    });

    await expect(getSiteSettings()).resolves.toMatchObject({
      degraded: true,
      settings: {
        siteName: "Remote Brand",
        primaryColor: "#123456",
        seo: DEFAULT_SITE_SETTINGS.seo,
        pageSeo: DEFAULT_SITE_SETTINGS.pageSeo,
      },
      source: "config",
    });
  });

  it("returns fallback settings when the config row is unavailable", async () => {
    mockSiteSettingsQuery({ data: null, error: null });

    await expect(getSiteSettings()).resolves.toEqual({
      degraded: true,
      settings: DEFAULT_SITE_SETTINGS,
      source: "fallback",
    });
  });

  it("keeps base settings when SEO columns are not available yet", async () => {
    mockSiteSettingsQueryQueue([
      {
        data: null,
        error: { message: "column site_settings.seo_title does not exist" },
      },
      {
        data: {
          id: SITE_SETTINGS_ID,
          site_name: " Baan Pool Villa ",
          primary_color: "#123456",
          accent_color: "#abcdef",
          logo_image_path: "logo/2026/05/logo.webp",
          logo_image_url:
            "https://example.supabase.co/storage/v1/object/public/site-assets/logo/2026/05/logo.webp",
          hero_image_path: "hero/2026/05/hero.webp",
          hero_image_url:
            "https://example.supabase.co/storage/v1/object/public/site-assets/hero/2026/05/hero.webp",
          hero_image_alt: "Pool villas",
          bank_account_name: " Account Name ",
          bank_name: " Bank Name ",
          bank_account_number: " 398-289-7482 ",
          phone_contacts: [
            {
              name: " Game ",
              phone: " 0617485213 ",
              time: " 07.00-15.00 ",
            },
          ],
          messenger_url: " https://www.facebook.com/baanpoolvillas ",
          line_id: " @baanpoolvilla ",
          line_url: " https://line.me/R/ti/p/@baanpoolvilla ",
        },
        error: null,
      },
    ]);

    await expect(getSiteSettings()).resolves.toMatchObject({
      settings: {
        siteName: "Baan Pool Villa",
        seo: DEFAULT_SITE_SETTINGS.seo,
      },
      source: "config",
    });
  });

  it("falls back to a full non-TikTok schema when TikTok columns are missing", async () => {
    mockSiteSettingsQueryQueue([
      {
        data: null,
        error: { message: "column site_settings.tiktok_account_url does not exist" },
      },
      {
        data: {
          id: SITE_SETTINGS_ID,
          site_name: " Baan Pool Villa ",
          primary_color: "#123456",
          accent_color: "#abcdef",
          logo_image_path: "logo/2026/05/logo.webp",
          logo_image_url:
            "https://example.supabase.co/storage/v1/object/public/site-assets/logo/2026/05/logo.webp",
          hero_image_path: "hero/2026/05/hero.webp",
          hero_image_url:
            "https://example.supabase.co/storage/v1/object/public/site-assets/hero/2026/05/hero.webp",
          hero_image_alt: "Pool villas",
          bank_account_name: " Account Name ",
          bank_name: " Bank Name ",
          bank_account_number: " 398-289-7482 ",
          phone_contacts: [
            {
              name: " Game ",
              phone: " 0617485213 ",
              time: " 07.00-15.00 ",
            },
          ],
          messenger_url: " https://www.facebook.com/baanpoolvillas ",
          line_id: " @baanpoolvilla ",
          line_url: " https://line.me/R/ti/p/@baanpoolvilla ",
          detail_layout: DEFAULT_DETAIL_LAYOUT,
        },
        error: null,
      },
    ]);

    await expect(getSiteSettings()).resolves.toMatchObject({
      settings: {
        seo: DEFAULT_SITE_SETTINGS.seo,
        pageSeo: DEFAULT_SITE_SETTINGS.pageSeo,
        detailLayout: DEFAULT_DETAIL_LAYOUT,
        tiktok: {
          accountUrl: "",
          videos: [],
        },
      },
      source: "config",
    });
  });

  it("keeps base settings when legacy contact columns are unavailable", async () => {
    mockSiteSettingsQueryQueue([
      {
        data: null,
        error: { message: "column site_settings.bank_account_name does not exist" },
      },
      {
        data: {
          id: SITE_SETTINGS_ID,
          site_name: " Baan Pool Villa ",
          primary_color: "#123456",
          accent_color: "#abcdef",
          logo_image_path: "logo/2026/05/logo.webp",
          logo_image_url:
            "https://example.supabase.co/storage/v1/object/public/site-assets/logo/2026/05/logo.webp",
          hero_image_path: "hero/2026/05/hero.webp",
          hero_image_url:
            "https://example.supabase.co/storage/v1/object/public/site-assets/hero/2026/05/hero.webp",
          hero_image_alt: "Pool villas",
        },
        error: null,
      },
    ]);

    await expect(getSiteSettings()).resolves.toMatchObject({
      settings: {
        siteName: "Baan Pool Villa",
        primaryColor: "#123456",
        accentColor: "#abcdef",
        seo: DEFAULT_SITE_SETTINGS.seo,
      },
      source: "config",
    });
  });
});
