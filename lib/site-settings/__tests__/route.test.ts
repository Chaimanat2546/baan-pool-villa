import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertHomeConfigAdmin,
  getBearerToken,
  jsonError,
} from "@/lib/admin/home-config-auth";
import { revalidateSiteSettingsCache } from "@/lib/cache-revalidation";
import { DEFAULT_DETAIL_LAYOUT } from "../../detail-layout/defaults";
import { SITE_ASSETS_BUCKET, SITE_SETTINGS_ID } from "../defaults";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/admin/home-config-auth", () => ({
  assertHomeConfigAdmin: vi.fn(),
  getBearerToken: vi.fn(),
  jsonError: vi.fn(
    (
      message: string,
      status: number,
      extra?: Record<string, string | null | undefined>,
    ) => Response.json({ error: message, ...extra }, { status }),
  ),
}));

vi.mock("@/lib/cache-revalidation", () => ({
  revalidateSiteSettingsCache: vi.fn(),
}));

vi.mock("@/lib/site-settings/defaults", async () => import("../defaults"));
vi.mock("@/lib/site-settings/validation", async () => import("../validation"));

const assertHomeConfigAdminMock = vi.mocked(assertHomeConfigAdmin);
const getBearerTokenMock = vi.mocked(getBearerToken);
const jsonErrorMock = vi.mocked(jsonError);
const revalidateSiteSettingsCacheMock = vi.mocked(revalidateSiteSettingsCache);

const dbRow = {
  id: SITE_SETTINGS_ID,
  site_name: " Baan Pool Villa ",
  primary_color: "#064e3b",
  accent_color: "#eab308",
  logo_image_path: "logo/2026/05/logo.webp",
  logo_image_url: "https://example.com/logo.webp",
  hero_image_path: "hero/2026/05/hero.webp",
  hero_image_url: "https://example.com/hero.webp",
  hero_image_alt: " Pool villas ",
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
  seo_title: " Baan Pool Villa Pattaya | Private Pool Villas ",
  seo_description: " Book private pool villas in Pattaya. ",
  seo_og_image_url: " /images/seo-cover.jpg ",
  seo_og_image_alt: " Pool villa with private swimming pool ",
  seo_business_name: " Baan Pool Villa Pattaya ",
  seo_same_as_urls: [
    " https://www.facebook.com/baanpoolvillas ",
    " https://line.me/R/ti/p/@baanpoolvilla ",
  ],
  tiktok_account_url: " https://www.tiktok.com/@baanpoolvilla ",
  tiktok_video_urls: [
    "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000001?lang=th-TH",
    "https://www.tiktok.com/player/v1/7370000000000000002",
  ],
};
const dbRowWithoutTiktokColumns = {
  ...dbRow,
  tiktok_account_url: undefined,
  tiktok_video_urls: undefined,
};

function siteSettingsSelectQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });

  return { eq, maybeSingle, select };
}

function siteSettingsUpsertQuery(result: { data: unknown; error: unknown }) {
  const upsert = vi.fn().mockResolvedValue(result);

  return { upsert };
}

function uploadHistoryInsertQuery(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });

  return { insert, select, single };
}

function uploadHistoryUpdateQuery(result: { error: unknown }) {
  const chain = {
    eq: vi.fn(),
    neq: vi.fn().mockResolvedValue(result),
  };
  chain.eq.mockReturnValue(chain);
  const update = vi.fn().mockReturnValue(chain);

  return { chain, update };
}

function uploadHistoryDeleteQuery(result: { error: unknown }) {
  const eq = vi.fn().mockResolvedValue(result);
  const deleteMock = vi.fn().mockReturnValue({ eq });

  return { delete: deleteMock, eq };
}

function uploadHistorySelectQuery(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ order });

  return { order, select };
}

function fromQueue(queues: Record<string, unknown[]>) {
  return vi.fn((table: string) => {
    const queue = queues[table];

    if (!queue || queue.length === 0) {
      throw new Error(`Unexpected Supabase table call: ${table}`);
    }

    return queue.shift();
  });
}

function authenticatedRequest() {
  return new Request("https://example.com/api/admin/site-settings", {
    headers: { authorization: "Bearer token" },
  });
}

function settingsForm(overrides: Partial<Record<string, string>> = {}) {
  const formData = new FormData();

  formData.set("siteName", overrides.siteName ?? " Updated Villas ");
  formData.set("primaryColor", overrides.primaryColor ?? " #123ABC ");
  formData.set("accentColor", overrides.accentColor ?? " #FEDCBA ");
  formData.set("heroImageAlt", overrides.heroImageAlt ?? " Updated hero ");
  formData.set(
    "phoneContacts",
    overrides.phoneContacts ??
      JSON.stringify([
        {
          name: " คุณเกม ",
          phone: " 061-748-5213 ",
          time: " ช่วง 07.00-15.00 ",
        },
      ]),
  );
  formData.set(
    "bankAccountName",
    overrides.bankAccountName ?? " คุณ อาภัสรา จินดาวา ",
  );
  formData.set("bankName", overrides.bankName ?? " ธนาคารกสิกรไทย ");
  formData.set(
    "bankAccountNumber",
    overrides.bankAccountNumber ?? " 398-289-7482 ",
  );
  formData.set(
    "messengerUrl",
    overrides.messengerUrl ?? " https://www.facebook.com/baanpoolvillas ",
  );
  formData.set("lineId", overrides.lineId ?? " @baanpoolvilla ");
  formData.set(
    "lineUrl",
    overrides.lineUrl ?? " https://line.me/R/ti/p/@baanpoolvilla ",
  );
  formData.set(
    "seoTitle",
    overrides.seoTitle ?? " Baan Pool Villa Pattaya | Private Pool Villas ",
  );
  formData.set(
    "seoDescription",
    overrides.seoDescription ?? " Book private pool villas in Pattaya. ",
  );
  formData.set("seoOgImageUrl", overrides.seoOgImageUrl ?? " /images/seo-cover.jpg ");
  formData.set(
    "seoOgImageAlt",
    overrides.seoOgImageAlt ?? " Pool villa with private swimming pool ",
  );
  formData.set(
    "seoBusinessName",
    overrides.seoBusinessName ?? " Baan Pool Villa Pattaya ",
  );
  formData.set(
    "seoSameAsUrls",
    overrides.seoSameAsUrls ??
      JSON.stringify([
        " https://www.facebook.com/baanpoolvillas ",
        " https://line.me/R/ti/p/@baanpoolvilla ",
      ]),
  );
  if (overrides.tiktokAccountUrl !== undefined) {
    formData.set("tiktokAccountUrl", overrides.tiktokAccountUrl);
  }

  if (overrides.tiktokVideoUrls !== undefined) {
    formData.set("tiktokVideoUrls", overrides.tiktokVideoUrls);
  }

  return formData;
}

function putRequest(formData: FormData) {
  return new Request("https://example.com/api/admin/site-settings", {
    body: formData,
    headers: { authorization: "Bearer token" },
    method: "PUT",
  });
}

function authSupabase(supabase: unknown) {
  assertHomeConfigAdminMock.mockResolvedValue({
    ok: true,
    supabase,
  } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);
}

describe("admin site settings route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getBearerTokenMock.mockReturnValue("token");
  });

  it("requires admin auth and returns normalized settings on GET", async () => {
    const siteSettingsQuery = siteSettingsSelectQuery({
      data: dbRow,
      error: null,
    });
    const from = vi.fn().mockReturnValue(siteSettingsQuery);

    authSupabase({ from });

    const { GET } = await import(
      "../../../app/(admin)/api/admin/site-settings/route"
    );
    const response = await GET(authenticatedRequest());

    await expect(response.json()).resolves.toEqual({
      settings: {
        siteName: "Baan Pool Villa",
        primaryColor: "#064e3b",
        accentColor: "#eab308",
        logoImage: {
          path: "logo/2026/05/logo.webp",
          url: "https://example.com/logo.webp",
          alt: "Baan Pool Villa logo",
        },
        heroImage: {
          path: "hero/2026/05/hero.webp",
          url: "https://example.com/hero.webp",
          alt: "Pool villas",
        },
        bank: {
          accountName: "คุณ อาภัสรา จินดาวา",
          bankName: "ธนาคารกสิกรไทย",
          accountNumber: "398-289-7482",
        },
        contact: {
          phoneContacts: [
            {
              name: "คุณเกม",
              phone: "0617485213",
              time: "ช่วง 07.00-15.00",
            },
          ],
          messengerUrl: "https://www.facebook.com/baanpoolvillas",
          lineId: "@baanpoolvilla",
          lineUrl: "https://line.me/R/ti/p/@baanpoolvilla",
        },
        seo: {
          title: "Baan Pool Villa Pattaya | Private Pool Villas",
          description: "Book private pool villas in Pattaya.",
          ogImage: {
            path: "/images/seo-cover.jpg",
            url: "/images/seo-cover.jpg",
            alt: "Pool villa with private swimming pool",
          },
          businessName: "Baan Pool Villa Pattaya",
          sameAsUrls: [
            "https://www.facebook.com/baanpoolvillas",
            "https://line.me/R/ti/p/@baanpoolvilla",
          ],
        },
        detailLayout: DEFAULT_DETAIL_LAYOUT,
        tiktok: {
          accountUrl: "https://www.tiktok.com/@baanpoolvilla",
          videos: [
            {
              url: "https://www.tiktok.com/@baanpoolvillas/video/7370000000000000001?lang=th-TH",
              videoId: "7370000000000000001",
            },
            {
              url: "https://www.tiktok.com/player/v1/7370000000000000002",
              videoId: "7370000000000000002",
            },
          ],
        },
      },
    });
    expect(from).toHaveBeenCalledWith("site_settings");
    expect(siteSettingsQuery.select).toHaveBeenCalledWith(
      expect.stringContaining("tiktok_account_url"),
    );
    expect(siteSettingsQuery.select).toHaveBeenCalledWith(
      expect.stringContaining("tiktok_video_urls"),
    );
    expect(siteSettingsQuery.select).toHaveBeenCalledWith(
      expect.stringContaining("detail_layout"),
    );
    expect(siteSettingsQuery.eq).toHaveBeenCalledWith("id", SITE_SETTINGS_ID);
  });

  it("falls back to a non-TikTok schema for GET when TikTok columns are missing", async () => {
    const missingColumnError = {
      message: "column site_settings.tiktok_account_url does not exist",
      code: "42703",
    };
    const primaryQuery = siteSettingsSelectQuery({
      data: null,
      error: missingColumnError,
    });
    const fallbackQuery = siteSettingsSelectQuery({
      data: dbRowWithoutTiktokColumns,
      error: null,
    });
    const from = fromQueue({
      site_settings: [primaryQuery, fallbackQuery],
    });

    authSupabase({ from });

    const { GET } = await import(
      "../../../app/(admin)/api/admin/site-settings/route"
    );
    const response = await GET(authenticatedRequest());

    await expect(response.json()).resolves.toMatchObject({
      settings: {
        siteName: "Baan Pool Villa",
        primaryColor: "#064e3b",
        accentColor: "#eab308",
        heroImage: {
          path: "hero/2026/05/hero.webp",
          url: "https://example.com/hero.webp",
          alt: "Pool villas",
        },
        tiktok: {
          accountUrl: "",
          videos: [],
        },
      },
    });
    expect(primaryQuery.select).toHaveBeenCalledWith(
      expect.stringContaining("tiktok_account_url"),
    );
    expect(fallbackQuery.select).toHaveBeenCalledWith(
      expect.not.stringContaining("tiktok_account_url"),
    );
    expect(fallbackQuery.select).toHaveBeenCalledWith(
      expect.not.stringContaining("tiktok_video_urls"),
    );
    expect(fallbackQuery.select).toHaveBeenCalledWith(
      expect.stringContaining("detail_layout"),
    );
  });

  it("falls back to a general schema for GET when feature columns are missing", async () => {
    const primaryError = {
      message: "column site_settings.tiktok_account_url does not exist",
      code: "42703",
    };
    const fallbackError = {
      message: "column site_settings.detail_layout does not exist",
      code: "42703",
    };
    const primaryQuery = siteSettingsSelectQuery({
      data: null,
      error: primaryError,
    });
    const fallbackQuery = siteSettingsSelectQuery({
      data: null,
      error: fallbackError,
    });
    const generalQuery = siteSettingsSelectQuery({
      data: dbRowWithoutTiktokColumns,
      error: null,
    });
    const from = fromQueue({
      site_settings: [primaryQuery, fallbackQuery, generalQuery],
    });

    authSupabase({ from });

    const { GET } = await import(
      "../../../app/(admin)/api/admin/site-settings/route"
    );
    const response = await GET(authenticatedRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      settings: {
        siteName: "Baan Pool Villa",
        detailLayout: DEFAULT_DETAIL_LAYOUT,
        tiktok: {
          accountUrl: "",
          videos: [],
        },
      },
    });
    expect(generalQuery.select).toHaveBeenCalledWith(
      expect.not.stringContaining("detail_layout"),
    );
    expect(generalQuery.select).toHaveBeenCalledWith(
      expect.not.stringContaining("tiktok_account_url"),
    );
  });

  it("rejects missing auth before reading settings", async () => {
    getBearerTokenMock.mockReturnValue(null);

    const { GET } = await import(
      "../../../app/(admin)/api/admin/site-settings/route"
    );
    const response = await GET(authenticatedRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Missing bearer token.",
    });
    expect(assertHomeConfigAdminMock).not.toHaveBeenCalled();
  });

  it("rejects invalid PUT settings before uploading files", async () => {
    authSupabase({ from: vi.fn() });

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/site-settings/route"
    );
    const response = await PUT(
      putRequest(
        settingsForm({
          siteName: " ",
          primaryColor: "green",
          accentColor: "#12345",
          bankAccountName: "",
          bankName: "",
          bankAccountNumber: "",
          phoneContacts: JSON.stringify([{ name: "", phone: "", time: "" }]),
          messengerUrl: "not a url",
          lineId: "",
          lineUrl: "javascript:alert(1)",
        }),
      ),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errors).toContain("ต้องใส่ชื่อบัญชีธนาคาร");
    expect(body.errors).toContain("ลิงก์ LINE ต้องเป็น URL แบบ http หรือ https");
  });

  it("preserves existing image fields when PUT has no files", async () => {
    const loadQuery = siteSettingsSelectQuery({ data: dbRow, error: null });
    const saveQuery = siteSettingsUpsertQuery({
      data: null,
      error: null,
    });
    const reloadQuery = siteSettingsSelectQuery({
      data: {
        ...dbRow,
        site_name: "Updated Villas",
        primary_color: "#123abc",
        accent_color: "#fedcba",
        hero_image_alt: "Updated hero",
        phone_contacts: [
          {
            name: "คุณเกม",
            phone: "061-748-5213",
            time: "ช่วง 07.00-15.00",
          },
        ],
      },
      error: null,
    });
    const from = fromQueue({
      site_settings: [loadQuery, saveQuery, reloadQuery],
    });

    authSupabase({ from });

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/site-settings/route"
    );
    const response = await PUT(putRequest(settingsForm()));

    expect(saveQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: SITE_SETTINGS_ID,
        site_name: "Updated Villas",
        primary_color: "#123abc",
        accent_color: "#fedcba",
        logo_image_path: "logo/2026/05/logo.webp",
        logo_image_url: "https://example.com/logo.webp",
        hero_image_path: "hero/2026/05/hero.webp",
        hero_image_url: "https://example.com/hero.webp",
        hero_image_alt: "Updated hero",
        bank_account_name: "คุณ อาภัสรา จินดาวา",
        bank_name: "ธนาคารกสิกรไทย",
        bank_account_number: "398-289-7482",
        phone_contacts: [
          {
            name: "คุณเกม",
            phone: "061-748-5213",
            time: "ช่วง 07.00-15.00",
          },
        ],
        messenger_url: "https://www.facebook.com/baanpoolvillas",
        line_id: "@baanpoolvilla",
        line_url: "https://line.me/R/ti/p/@baanpoolvilla",
        seo_title: "Baan Pool Villa Pattaya | Private Pool Villas",
        seo_description: "Book private pool villas in Pattaya.",
        seo_og_image_url: "/images/seo-cover.jpg",
        seo_og_image_alt: "Pool villa with private swimming pool",
        seo_business_name: "Baan Pool Villa Pattaya",
        seo_same_as_urls: [
          "https://www.facebook.com/baanpoolvillas",
          "https://line.me/R/ti/p/@baanpoolvilla",
        ],
      }),
      { onConflict: "id" },
    );
    await expect(response.json()).resolves.toMatchObject({
      settings: {
        siteName: "Updated Villas",
        primaryColor: "#123abc",
        accentColor: "#fedcba",
        heroImage: {
          alt: "Updated hero",
          path: "hero/2026/05/hero.webp",
          url: "https://example.com/hero.webp",
        },
        logoImage: {
          path: "logo/2026/05/logo.webp",
          url: "https://example.com/logo.webp",
        },
        bank: {
          accountName: "คุณ อาภัสรา จินดาวา",
          bankName: "ธนาคารกสิกรไทย",
          accountNumber: "398-289-7482",
        },
        contact: {
          phoneContacts: [
            {
              name: "คุณเกม",
              phone: "061-748-5213",
              time: "ช่วง 07.00-15.00",
            },
          ],
          messengerUrl: "https://www.facebook.com/baanpoolvillas",
          lineId: "@baanpoolvilla",
          lineUrl: "https://line.me/R/ti/p/@baanpoolvilla",
        },
        seo: {
          title: "Baan Pool Villa Pattaya | Private Pool Villas",
          description: "Book private pool villas in Pattaya.",
          ogImage: {
            path: "/images/seo-cover.jpg",
            url: "/images/seo-cover.jpg",
            alt: "Pool villa with private swimming pool",
          },
          businessName: "Baan Pool Villa Pattaya",
          sameAsUrls: [
            "https://www.facebook.com/baanpoolvillas",
            "https://line.me/R/ti/p/@baanpoolvilla",
          ],
        },
      },
      warnings: [],
    });
    expect(jsonErrorMock).not.toHaveBeenCalled();
    expect(revalidateSiteSettingsCacheMock).toHaveBeenCalledTimes(1);
  });

  it("does not persist TikTok form fields in the site-settings upsert payload", async () => {
    const loadQuery = siteSettingsSelectQuery({ data: dbRow, error: null });
    const saveQuery = siteSettingsUpsertQuery({
      data: null,
      error: null,
    });
    const reloadQuery = siteSettingsSelectQuery({
      data: {
        ...dbRow,
        site_name: "Updated Villas",
        primary_color: "#123abc",
        accent_color: "#fedcba",
        hero_image_alt: "Updated hero",
      },
      error: null,
    });
    const from = fromQueue({
      site_settings: [loadQuery, saveQuery, reloadQuery],
    });

    authSupabase({ from });

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/site-settings/route"
    );
    const response = await PUT(
      putRequest(
        settingsForm({
          tiktokAccountUrl: " https://www.tiktok.com/@stale-client ",
          tiktokVideoUrls: JSON.stringify([
            "https://www.tiktok.com/@stale-client/video/7370000000000000001",
          ]),
        }),
      ),
    );

    expect(response.status).toBe(200);
    const [payload] = saveQuery.upsert.mock.calls[0];

    expect(payload).toMatchObject({
      id: SITE_SETTINGS_ID,
      site_name: "Updated Villas",
      primary_color: "#123abc",
      accent_color: "#fedcba",
      logo_image_path: "logo/2026/05/logo.webp",
      logo_image_url: "https://example.com/logo.webp",
      hero_image_path: "hero/2026/05/hero.webp",
      hero_image_url: "https://example.com/hero.webp",
      hero_image_alt: "Updated hero",
      messenger_url: "https://www.facebook.com/baanpoolvillas",
      line_id: "@baanpoolvilla",
      line_url: "https://line.me/R/ti/p/@baanpoolvilla",
      seo_title: "Baan Pool Villa Pattaya | Private Pool Villas",
      seo_description: "Book private pool villas in Pattaya.",
      seo_og_image_url: "/images/seo-cover.jpg",
      seo_og_image_alt: "Pool villa with private swimming pool",
      seo_business_name: "Baan Pool Villa Pattaya",
      seo_same_as_urls: [
        "https://www.facebook.com/baanpoolvillas",
        "https://line.me/R/ti/p/@baanpoolvilla",
      ],
    });
    expect(payload).not.toHaveProperty("tiktok_account_url");
    expect(payload).not.toHaveProperty("tiktok_video_urls");
  });

  it("falls back after write-only save on PUT when TikTok columns are missing", async () => {
    const missingColumnError = {
      message: "column site_settings.tiktok_account_url does not exist",
      code: "42703",
    };
    const loadQuery = siteSettingsSelectQuery({
      data: null,
      error: missingColumnError,
    });
    const fallbackLoadQuery = siteSettingsSelectQuery({
      data: dbRowWithoutTiktokColumns,
      error: null,
    });
    const saveQuery = siteSettingsUpsertQuery({
      data: null,
      error: null,
    });
    const reloadQuery = siteSettingsSelectQuery({
      data: null,
      error: missingColumnError,
    });
    const fallbackReloadQuery = siteSettingsSelectQuery({
      data: {
        ...dbRowWithoutTiktokColumns,
        site_name: "Updated Villas",
        primary_color: "#123abc",
        accent_color: "#fedcba",
        hero_image_alt: "Updated hero",
      },
      error: null,
    });
    const from = fromQueue({
      site_settings: [
        loadQuery,
        fallbackLoadQuery,
        saveQuery,
        reloadQuery,
        fallbackReloadQuery,
      ],
    });

    authSupabase({ from });

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/site-settings/route"
    );
    const response = await PUT(putRequest(settingsForm()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      settings: {
        siteName: "Updated Villas",
        primaryColor: "#123abc",
        accentColor: "#fedcba",
        heroImage: {
          alt: "Updated hero",
        },
        tiktok: {
          accountUrl: "",
          videos: [],
        },
      },
      warnings: [],
    });
    expect(fallbackLoadQuery.select).toHaveBeenCalledWith(
      expect.not.stringContaining("tiktok_video_urls"),
    );
    expect(saveQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: SITE_SETTINGS_ID,
        site_name: "Updated Villas",
        primary_color: "#123abc",
        accent_color: "#fedcba",
        logo_image_path: "logo/2026/05/logo.webp",
        logo_image_url: "https://example.com/logo.webp",
        hero_image_path: "hero/2026/05/hero.webp",
        hero_image_url: "https://example.com/hero.webp",
        hero_image_alt: "Updated hero",
      }),
      { onConflict: "id" },
    );
    expect(fallbackReloadQuery.select).toHaveBeenCalledWith(
      expect.not.stringContaining("tiktok_video_urls"),
    );
    expect(revalidateSiteSettingsCacheMock).toHaveBeenCalledTimes(1);
  });

  it("uploads an image, records history, saves settings, and cleans eligible old rows", async () => {
    const loadQuery = siteSettingsSelectQuery({ data: dbRow, error: null });
    const historyInsertQuery = uploadHistoryInsertQuery({
      data: { id: "new-logo-upload" },
      error: null,
    });
    const saveQuery = siteSettingsUpsertQuery({
      data: null,
      error: null,
    });
    const reloadQuery = siteSettingsSelectQuery({
      data: {
        ...dbRow,
        logo_image_path: "logo/2026/05/upload.webp",
        logo_image_url: "https://cdn.example.com/upload.webp",
      },
      error: null,
    });
    const historyUpdateQuery = uploadHistoryUpdateQuery({ error: null });
    const historySelectQuery = uploadHistorySelectQuery({
      data: [
        {
          id: "old-logo-upload-1",
          asset_type: "logo",
          storage_bucket: SITE_ASSETS_BUCKET,
          storage_path: "logo/2026/04/old-1.webp",
          is_current: false,
          created_at: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "old-logo-upload-2",
          asset_type: "logo",
          storage_bucket: SITE_ASSETS_BUCKET,
          storage_path: "logo/2026/04/old-2.webp",
          is_current: false,
          created_at: "2026-04-02T00:00:00.000Z",
        },
        {
          id: "old-logo-upload-3",
          asset_type: "logo",
          storage_bucket: SITE_ASSETS_BUCKET,
          storage_path: "logo/2026/04/old-3.webp",
          is_current: false,
          created_at: "2026-04-03T00:00:00.000Z",
        },
        {
          id: "old-logo-upload-4",
          asset_type: "logo",
          storage_bucket: SITE_ASSETS_BUCKET,
          storage_path: "logo/2026/04/old-4.webp",
          is_current: false,
          created_at: "2026-04-04T00:00:00.000Z",
        },
        {
          id: "bad-bucket-upload",
          asset_type: "hero",
          storage_bucket: "other",
          storage_path: "hero/2026/04/old.webp",
          is_current: false,
          created_at: "2026-04-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const historyCleanupDeleteQuery = uploadHistoryDeleteQuery({ error: null });
    const from = fromQueue({
      site_asset_uploads: [
        historyInsertQuery,
        historyUpdateQuery,
        historySelectQuery,
        historyCleanupDeleteQuery,
      ],
      site_settings: [loadQuery, saveQuery, reloadQuery],
    });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: "https://cdn.example.com/upload.webp" },
    });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const storageFrom = vi.fn().mockReturnValue({ getPublicUrl, remove, upload });

    authSupabase({ from, storage: { from: storageFrom } });

    const formData = settingsForm();
    formData.set(
      "logo",
      new File(["logo"], "logo.webp", { type: "image/webp" }),
    );

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/site-settings/route"
    );
    const response = await PUT(putRequest(formData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^logo\/\d{4}\/\d{2}\/[0-9a-f-]+\.webp$/),
      expect.any(File),
      {
        cacheControl: "31536000",
        contentType: "image/webp",
        upsert: false,
      },
    );
    expect(historyInsertQuery.insert).toHaveBeenCalledWith({
      asset_type: "logo",
      storage_bucket: SITE_ASSETS_BUCKET,
      storage_path: expect.stringMatching(/^logo\/\d{4}\/\d{2}\/[0-9a-f-]+\.webp$/),
      public_url: "https://cdn.example.com/upload.webp",
      is_current: true,
    });
    expect(historyUpdateQuery.chain.neq).toHaveBeenCalledWith(
      "id",
      "new-logo-upload",
    );
    expect(remove).toHaveBeenCalledWith(["logo/2026/04/old-1.webp"]);
    expect(historyCleanupDeleteQuery.eq).toHaveBeenCalledWith(
      "id",
      "old-logo-upload-1",
    );
    expect(body.settings.logoImage).toMatchObject({
      path: "logo/2026/05/upload.webp",
      url: "https://cdn.example.com/upload.webp",
    });
    expect(body.warnings).toEqual([
      "Skipped cleanup for hero upload with unexpected storage location.",
    ]);
    expect(revalidateSiteSettingsCacheMock).toHaveBeenCalledTimes(1);
  });

  it("returns a detailed error when storage upload fails", async () => {
    const loadQuery = siteSettingsSelectQuery({ data: dbRow, error: null });
    const from = fromQueue({ site_settings: [loadQuery] });
    const uploadError = {
      message: "Storage rejected upload",
      code: "storage_error",
      details: "object limit",
      hint: "try a smaller file",
    };
    const upload = vi.fn().mockResolvedValue({ error: uploadError });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const storageFrom = vi.fn().mockReturnValue({
      getPublicUrl: vi.fn(),
      remove,
      upload,
    });

    authSupabase({ from, storage: { from: storageFrom } });

    const formData = settingsForm();
    formData.set(
      "hero",
      new File(["hero"], "hero.webp", { type: "image/webp" }),
    );

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/site-settings/route"
    );
    const response = await PUT(putRequest(formData));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Storage rejected upload",
      code: "storage_error",
      details: "object limit",
      hint: "try a smaller file",
    });
    expect(from).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });

  it("cleans up uploaded storage when upload history insert fails", async () => {
    const loadQuery = siteSettingsSelectQuery({ data: dbRow, error: null });
    const historyError = {
      message: "History insert failed",
      code: "42501",
      details: "RLS denied",
      hint: "check admin policy",
    };
    const historyInsertQuery = uploadHistoryInsertQuery({
      data: null,
      error: historyError,
    });
    const from = fromQueue({
      site_asset_uploads: [historyInsertQuery],
      site_settings: [loadQuery],
    });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: "https://cdn.example.com/logo.webp" },
    });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const storageFrom = vi.fn().mockReturnValue({ getPublicUrl, remove, upload });

    authSupabase({ from, storage: { from: storageFrom } });

    const formData = settingsForm();
    formData.set(
      "logo",
      new File(["logo"], "logo.webp", { type: "image/webp" }),
    );

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/site-settings/route"
    );
    const response = await PUT(putRequest(formData));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "History insert failed",
      code: "42501",
      details: "RLS denied",
      hint: "check admin policy",
    });
    expect(remove).toHaveBeenCalledWith([
      expect.stringMatching(/^logo\/\d{4}\/\d{2}\/[0-9a-f-]+\.webp$/),
    ]);
  });

  it("returns an error when previous upload history cannot be updated", async () => {
    const loadQuery = siteSettingsSelectQuery({ data: dbRow, error: null });
    const historyInsertQuery = uploadHistoryInsertQuery({
      data: { id: "new-logo-upload" },
      error: null,
    });
    const saveQuery = siteSettingsUpsertQuery({
      data: null,
      error: null,
    });
    const reloadQuery = siteSettingsSelectQuery({
      data: {
        ...dbRow,
        logo_image_path: "logo/2026/05/upload.webp",
        logo_image_url: "https://cdn.example.com/upload.webp",
      },
      error: null,
    });
    const updateError = {
      message: "History update failed",
      code: "42501",
      details: "RLS denied update",
      hint: "check update policy",
    };
    const historyUpdateQuery = uploadHistoryUpdateQuery({ error: updateError });
    const from = fromQueue({
      site_asset_uploads: [historyInsertQuery, historyUpdateQuery],
      site_settings: [loadQuery, saveQuery, reloadQuery],
    });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: "https://cdn.example.com/upload.webp" },
    });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const storageFrom = vi.fn().mockReturnValue({ getPublicUrl, remove, upload });

    authSupabase({ from, storage: { from: storageFrom } });

    const formData = settingsForm();
    formData.set(
      "logo",
      new File(["logo"], "logo.webp", { type: "image/webp" }),
    );

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/site-settings/route"
    );
    const response = await PUT(putRequest(formData));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "History update failed",
      code: "42501",
      details: "RLS denied update",
      hint: "check update policy",
    });
    expect(historyUpdateQuery.chain.neq).toHaveBeenCalledWith(
      "id",
      "new-logo-upload",
    );
  });

  it("cleans up uploaded storage and history when settings save fails", async () => {
    const loadQuery = siteSettingsSelectQuery({ data: dbRow, error: null });
    const historyInsertQuery = uploadHistoryInsertQuery({
      data: { id: "new-hero-upload" },
      error: null,
    });
    const saveError = {
      message: "Save failed",
      code: "23514",
      details: "check constraint",
      hint: "fix payload",
    };
    const saveQuery = siteSettingsUpsertQuery({
      data: null,
      error: saveError,
    });
    const historyDeleteQuery = uploadHistoryDeleteQuery({ error: null });
    const from = fromQueue({
      site_asset_uploads: [historyInsertQuery, historyDeleteQuery],
      site_settings: [loadQuery, saveQuery],
    });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: "https://cdn.example.com/hero.webp" },
    });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const storageFrom = vi.fn().mockReturnValue({ getPublicUrl, remove, upload });

    authSupabase({ from, storage: { from: storageFrom } });

    const formData = settingsForm();
    formData.set(
      "hero",
      new File(["hero"], "hero.webp", { type: "image/webp" }),
    );

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/site-settings/route"
    );
    const response = await PUT(putRequest(formData));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Save failed",
      code: "23514",
      details: "check constraint",
      hint: "fix payload",
    });
    expect(historyDeleteQuery.eq).toHaveBeenCalledWith("id", "new-hero-upload");
    expect(remove).toHaveBeenCalledWith([
      expect.stringMatching(/^hero\/\d{4}\/\d{2}\/[0-9a-f-]+\.webp$/),
    ]);
  });
});
