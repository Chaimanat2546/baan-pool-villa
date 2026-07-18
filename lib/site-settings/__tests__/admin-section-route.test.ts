import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  revalidateSiteSeoSettingsCache,
  revalidateSiteSettingsCache,
} from "@/lib/cache-revalidation";
import { SITE_SETTINGS_ID } from "../defaults";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/cache-revalidation", () => ({
  revalidateSiteSeoSettingsCache: vi.fn(),
  revalidateSiteSettingsCache: vi.fn(),
}));

const revalidateSiteSeoSettingsCacheMock = vi.mocked(revalidateSiteSeoSettingsCache);
const revalidateSiteSettingsCacheMock = vi.mocked(revalidateSiteSettingsCache);

const brandRow = {
  id: SITE_SETTINGS_ID,
  site_name: "Baan Pool Villa",
  logo_background: "white",
  logo_image_path: "logo/current.webp",
  logo_image_url: "https://example.com/logo.webp",
  favicon_image_path: "favicon/current.webp",
  favicon_image_url: "https://example.com/favicon.webp",
};

const themeRow = {
  id: SITE_SETTINGS_ID,
  primary_color: "#064e3b",
  accent_color: "#eab308",
  header_link_color: "#f8fafc",
  header_link_hover_color: "#fde68a",
  footer_link_color: "#e2e8f0",
  footer_link_hover_color: "#facc15",
  bank_highlight_color: "#fde047",
  bank_account_highlight_color: "#1d4ed8",
  bank_name_highlight_color: "#7c3aed",
  bank_number_highlight_color: "#be123c",
  site_name: "Preview Villas",
  logo_background: "white",
  logo_image_path: "logo/current.webp",
  logo_image_url: "https://example.com/logo.webp",
  bank_account_name: "Preview Account",
  bank_name: "Preview Bank",
  bank_account_number: "123-456-7890",
  phone_contacts: [{ name: "Sales", phone: "0812345678", time: "09:00-18:00" }],
  messenger_url: "https://m.me/example",
  line_id: "@preview",
  line_url: "https://line.me/R/ti/p/@preview",
};

const seoRows = [
  {
    page_type: "global",
    settings: {
      title: "Baan Pool Villa",
      description: "Pool villas",
      keywords: ["pool villa"],
      ogImageUrl: "https://example.com/og.webp",
      ogImageAlt: "Pool villa",
      businessName: "Baan Pool Villa",
      sameAsUrls: [],
    },
  },
  {
    page_type: "search",
    settings: {
      title: "Search villas",
      description: "Search pool villas",
      keywords: ["search villas"],
      ogImageUrl: "https://example.com/search.webp",
      ogImageAlt: "Search villas",
    },
  },
  {
    page_type: "guides",
    settings: {
      title: "Villa guides",
      description: "Pool villa guides",
      keywords: ["villa guides"],
      ogImageUrl: "https://example.com/guides.webp",
      ogImageAlt: "Villa guides",
    },
  },
  {
    page_type: "villa_detail",
    settings: { keywords: ["villa detail"] },
  },
];

const incompleteSeoRowSets = [
  ["null", null],
  ["empty", []],
  ["partial", seoRows.slice(0, 3)],
  ["duplicate", [...seoRows.slice(0, 3), seoRows[0]]],
  [
    "invalid settings",
    seoRows.map((row, index) => index === 2 ? { ...row, settings: null } : row),
  ],
] as const;

function selectQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { eq, maybeSingle, select };
}

function updateQuery(result: { data?: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: result.data === undefined && !result.error ? { id: SITE_SETTINGS_ID } : result.data,
    error: result.error,
  });
  const select = vi.fn().mockReturnValue({ maybeSingle });
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  return { eq, maybeSingle, select, update };
}

function seoSelectQuery(result: { data: unknown; error: unknown }) {
  return { select: vi.fn().mockResolvedValue(result) };
}

function upsertQuery(result: { data: unknown; error: unknown }) {
  const select = vi.fn().mockResolvedValue(result);
  const upsert = vi.fn().mockReturnValue({ select });
  return { select, upsert };
}

function historyInsertQuery(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  return { insert, select, single };
}

function historyUpdateQuery(result: { error: unknown }) {
  const chain = { eq: vi.fn(), neq: vi.fn().mockResolvedValue(result) };
  chain.eq.mockReturnValue(chain);
  return { chain, update: vi.fn().mockReturnValue(chain) };
}

function historyDeleteQuery(result: { error: unknown }) {
  const eq = vi.fn().mockResolvedValue(result);
  return { delete: vi.fn().mockReturnValue({ eq }), eq };
}

function historyCleanupOrUpdateQuery(result: { error: unknown }) {
  return {
    ...historyDeleteQuery(result),
    ...historyUpdateQuery(result),
  };
}

function historySelectQuery(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const inFilter = vi.fn().mockReturnValue({ order });
  return { select: vi.fn().mockReturnValue({ in: inFilter }) };
}

function fromQueue(queues: Record<string, unknown[]>) {
  return vi.fn((table: string) => {
    const queue = queues[table];
    if (!queue?.length) throw new Error(`Unexpected Supabase table call: ${table}`);
    return queue.shift();
  });
}

function storage(options: {
  uploads?: Array<{ error: unknown }>;
  removeError?: unknown;
} = {}) {
  const uploads = [...(options.uploads ?? [])];
  const upload = vi.fn(() => Promise.resolve(uploads.shift() ?? { error: null }));
  const remove = vi.fn().mockResolvedValue({ error: options.removeError ?? null });
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://cdn.example.com/${path}` },
  }));
  return {
    getPublicUrl,
    remove,
    upload,
    from: vi.fn().mockReturnValue({ getPublicUrl, remove, upload }),
  };
}

function themeRequest(body: Record<string, unknown>) {
  return new Request("https://example.com/api/admin/site-settings/theme", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  });
}

function brandRequest(files: Record<string, File>) {
  const body = new FormData();
  body.set("siteName", "Updated Villas");
  body.set("logoBackground", "primary");
  Object.entries(files).forEach(([name, file]) => body.set(name, file));
  return new Request("https://example.com/api/admin/site-settings/brand", {
    body,
    method: "PATCH",
  });
}

function seoRequest(files: Record<string, File>) {
  const body = new FormData();
  Object.entries(files).forEach(([name, file]) => body.set(name, file));
  return new Request("https://example.com/api/admin/site-settings/seo", {
    body,
    method: "PATCH",
  });
}

describe("admin site-settings section route helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revalidateSiteSeoSettingsCacheMock.mockResolvedValue(undefined);
    revalidateSiteSettingsCacheMock.mockResolvedValue(undefined);
  });

  it("loads and returns only the requested Brand projection", async () => {
    const query = selectQuery({ data: brandRow, error: null });
    const supabase = { from: vi.fn().mockReturnValue(query) };
    const { buildAdminSiteSettingsSectionResponse } = await import("../admin-section-route");

    const response = await buildAdminSiteSettingsSectionResponse("brand", supabase as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      section: "brand",
      settings: { siteName: "Baan Pool Villa" },
    });
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining("site_name"));
    expect(query.select).not.toHaveBeenCalledWith(expect.stringContaining("tiktok"));
  });

  it("returns only Theme fields with the Theme response", async () => {
    const query = selectQuery({ data: themeRow, error: null });
    const supabase = { from: vi.fn().mockReturnValue(query) };
    const { buildAdminSiteSettingsSectionResponse } = await import("../admin-section-route");

    const response = await buildAdminSiteSettingsSectionResponse("theme", supabase as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      section: "theme",
      settings: { primaryColor: "#064e3b" },
    });
    expect(query.select).not.toHaveBeenCalledWith(expect.stringContaining("bank_account_number"));
  });

  it("loads SEO from the four site_seo_settings rows without reading site_settings", async () => {
    const query = seoSelectQuery({ data: seoRows, error: null });
    const from = fromQueue({ site_seo_settings: [query] });
    const { buildAdminSiteSettingsSectionResponse } = await import("../admin-section-route");

    const response = await buildAdminSiteSettingsSectionResponse("seo", { from } as never);

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("site_seo_settings");
    expect(query.select).toHaveBeenCalledWith("page_type,settings");
    await expect(response.json()).resolves.toMatchObject({
      section: "seo",
      settings: {
        seo: { title: "Baan Pool Villa" },
        pageSeo: {
          guides: { title: "Villa guides" },
          search: { title: "Search villas" },
          villaDetail: { keywords: ["villa detail"] },
        },
      },
    });
  });

  it.each(incompleteSeoRowSets)(
    "rejects a %s SEO row set instead of synthesizing defaults",
    async (_name, data) => {
      const query = seoSelectQuery({ data, error: null });
      const from = fromQueue({ site_seo_settings: [query] });
      const { buildAdminSiteSettingsSectionResponse } = await import("../admin-section-route");

      const response = await buildAdminSiteSettingsSectionResponse("seo", { from } as never);

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({
        code: "SITE_SEO_SETTINGS_INCOMPLETE",
        details: expect.stringContaining("global, search, guides, villa_detail"),
        error: "SEO settings rows are incomplete.",
      });
    },
  );

  it("returns 404 for an unknown section before touching Supabase", async () => {
    const from = vi.fn();
    const { buildAdminSiteSettingsSectionResponse } = await import("../admin-section-route");

    const response = await buildAdminSiteSettingsSectionResponse("unknown", { from } as never);

    expect(response.status).toBe(404);
    expect(from).not.toHaveBeenCalled();
  });

  it("retries only missing-column failures with the next section projection", async () => {
    const missing = selectQuery({ data: null, error: { code: "42703", message: "column missing" } });
    const fallback = selectQuery({ data: { ...brandRow, favicon_image_path: undefined }, error: null });
    const from = fromQueue({ site_settings: [missing, fallback] });
    const { buildAdminSiteSettingsSectionResponse } = await import("../admin-section-route");

    const response = await buildAdminSiteSettingsSectionResponse("brand", { from } as never);

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("stops section projection fallback on non-missing-column errors", async () => {
    const failed = selectQuery({ data: null, error: { code: "42501", message: "denied" } });
    const fallback = selectQuery({ data: brandRow, error: null });
    const from = fromQueue({ site_settings: [failed, fallback] });
    const { buildAdminSiteSettingsSectionResponse } = await import("../admin-section-route");

    const response = await buildAdminSiteSettingsSectionResponse("brand", { from } as never);

    expect(response.status).toBe(403);
    expect(from).toHaveBeenCalledTimes(1);
    expect(fallback.select).not.toHaveBeenCalled();
  });

  it("rejects a missing singleton before upload or history work", async () => {
    const load = selectQuery({ data: null, error: null });
    const storageApi = storage();
    const from = fromQueue({ site_settings: [load] });
    const { saveAdminSiteSettingsSection } = await import("../admin-section-route");

    const response = await saveAdminSiteSettingsSection(
      brandRequest({ logo: new File(["logo"], "logo.webp", { type: "image/webp" }) }),
      "brand",
      { from, storage: storageApi } as never,
    );

    expect(response.status).toBe(404);
    expect(storageApi.upload).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("updates only Theme columns and revalidates the shared settings cache", async () => {
    const load = selectQuery({ data: themeRow, error: null });
    const save = updateQuery({ error: null });
    const reload = selectQuery({ data: { ...themeRow, primary_color: "#112233", accent_color: "#445566" }, error: null });
    const from = fromQueue({ site_settings: [load, save, reload] });
    const { saveAdminSiteSettingsSection } = await import("../admin-section-route");

    const response = await saveAdminSiteSettingsSection(
      themeRequest({ primaryColor: "#112233", accentColor: "#445566" }),
      "theme",
      { from, storage: storage() } as never,
    );

    expect(response.status).toBe(200);
    expect(save.update).toHaveBeenCalledWith({
      primary_color: "#112233",
      accent_color: "#445566",
      header_link_color: expect.any(String),
      header_link_hover_color: expect.any(String),
      footer_link_color: expect.any(String),
      footer_link_hover_color: expect.any(String),
      bank_highlight_color: expect.any(String),
      bank_account_highlight_color: expect.any(String),
      bank_name_highlight_color: expect.any(String),
      bank_number_highlight_color: expect.any(String),
    });
    expect(save.update.mock.calls[0]?.[0]).not.toHaveProperty("site_name");
    expect(save.update.mock.calls[0]?.[0]).not.toHaveProperty("seo_title");
    expect(save.eq).toHaveBeenCalledWith("id", SITE_SETTINGS_ID);
    expect(revalidateSiteSettingsCacheMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      section: "theme",
      verified: true,
      warnings: [],
    });
  });

  it("persists only Theme columns returned by a fallback projection", async () => {
    const missing = () => selectQuery({
      data: null,
      error: { code: "42703", message: "column missing" },
    });
    const load = selectQuery({
      data: { id: SITE_SETTINGS_ID, primary_color: "#064e3b", accent_color: "#eab308" },
      error: null,
    });
    const save = updateQuery({ error: null });
    const reload = selectQuery({
      data: { id: SITE_SETTINGS_ID, primary_color: "#112233", accent_color: "#445566" },
      error: null,
    });
    const from = fromQueue({ site_settings: [missing(), load, save, missing(), reload] });
    const { saveAdminSiteSettingsSection } = await import("../admin-section-route");

    const response = await saveAdminSiteSettingsSection(
      themeRequest({ primaryColor: "#112233", accentColor: "#445566" }),
      "theme",
      { from, storage: storage() } as never,
    );

    expect(response.status).toBe(200);
    expect(save.update).toHaveBeenCalledWith({
      primary_color: "#112233",
      accent_color: "#445566",
    });
  });

  it("rejects favicon uploads before storage when the Brand fallback cannot persist them", async () => {
    const missing = () => selectQuery({
      data: null,
      error: { code: "42703", message: "column missing" },
    });
    const fallbackRow = {
      id: SITE_SETTINGS_ID,
      site_name: "Baan Pool Villa",
      logo_background: "white",
      logo_image_path: "logo/current.webp",
      logo_image_url: "https://example.com/logo.webp",
    };
    const fallback = selectQuery({
      data: fallbackRow,
      error: null,
    });
    const history = historyInsertQuery({ data: { id: "new-favicon" }, error: null });
    const save = updateQuery({ error: null });
    const markInactive = historyUpdateQuery({ error: null });
    const retention = historySelectQuery({ data: [], error: null });
    const reload = selectQuery({ data: fallbackRow, error: null });
    const storageApi = storage();
    const from = fromQueue({
      site_settings: [missing(), fallback, save, missing(), reload],
      site_asset_uploads: [history, markInactive, retention],
    });
    const { saveAdminSiteSettingsSection } = await import("../admin-section-route");

    const response = await saveAdminSiteSettingsSection(
      brandRequest({ faviconFile: new File(["favicon"], "favicon.webp", { type: "image/webp" }) }),
      "brand",
      { from, storage: storageApi } as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: ["The current settings schema cannot save the favicon image."],
    });
    expect(storageApi.upload).not.toHaveBeenCalled();
    expect(history.insert).not.toHaveBeenCalled();
  });

  it("upserts exactly four SEO rows and preserves all three uploaded image URLs", async () => {
    const load = seoSelectQuery({ data: seoRows, error: null });
    const save = upsertQuery({ data: seoRows, error: null });
    const reload = seoSelectQuery({ data: seoRows, error: null });
    const histories = ["new-seo-og", "new-search-og", "new-guides-og"].map((id) =>
      historyInsertQuery({ data: { id }, error: null }));
    const markInactive = [1, 2, 3].map(() => historyUpdateQuery({ error: null }));
    const retention = historySelectQuery({ data: [], error: null });
    const storageApi = storage();
    const from = fromQueue({
      site_seo_settings: [load, save, reload],
      site_asset_uploads: [...histories, ...markInactive, retention],
    });
    const { saveAdminSiteSettingsSection } = await import("../admin-section-route");

    const response = await saveAdminSiteSettingsSection(
      seoRequest({
        seoOgImageFile: new File(["global"], "global.webp", { type: "image/webp" }),
        searchSeoOgImageFile: new File(["search"], "search.webp", { type: "image/webp" }),
        guidesSeoOgImageFile: new File(["guides"], "guides.webp", { type: "image/webp" }),
      }),
      "seo",
      { from, storage: storageApi } as never,
    );

    expect(response.status).toBe(200);
    expect(save.upsert).toHaveBeenCalledTimes(1);
    const [rows, options] = save.upsert.mock.calls[0];
    expect(options).toEqual({ onConflict: "page_type" });
    expect(rows).toHaveLength(4);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        page_type: "global",
        settings: expect.objectContaining({ ogImageUrl: expect.stringContaining("/seo-og/") }),
      }),
      expect.objectContaining({
        page_type: "search",
        settings: expect.objectContaining({ ogImageUrl: expect.stringContaining("/search-seo-og/") }),
      }),
      expect.objectContaining({
        page_type: "guides",
        settings: expect.objectContaining({ ogImageUrl: expect.stringContaining("/guides-seo-og/") }),
      }),
      expect.objectContaining({ page_type: "villa_detail" }),
    ]));
    expect(from.mock.calls.some(([table]) => table === "site_settings")).toBe(false);
    expect(revalidateSiteSeoSettingsCacheMock).toHaveBeenCalledTimes(1);
    expect(revalidateSiteSettingsCacheMock).not.toHaveBeenCalled();
  });

  it("returns detailed SEO upsert errors and cleans uploaded files and history", async () => {
    const load = seoSelectQuery({ data: seoRows, error: null });
    const save = upsertQuery({
      data: null,
      error: {
        code: "42501",
        details: "RLS rejected four-row upsert",
        hint: "Check the admin write policy",
        message: "SEO save denied",
      },
    });
    const history = historyInsertQuery({ data: { id: "new-seo-og" }, error: null });
    const historyDelete = historyDeleteQuery({ error: null });
    const storageApi = storage();
    const from = fromQueue({
      site_seo_settings: [load, save],
      site_asset_uploads: [history, historyDelete],
    });
    const { saveAdminSiteSettingsSection } = await import("../admin-section-route");

    const response = await saveAdminSiteSettingsSection(
      seoRequest({ seoOgImageFile: new File(["global"], "global.webp", { type: "image/webp" }) }),
      "seo",
      { from, storage: storageApi } as never,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "42501",
      details: "RLS rejected four-row upsert",
      error: "SEO save denied",
      hint: "Check the admin write policy",
    });
    expect(historyDelete.eq).toHaveBeenCalledWith("id", "new-seo-og");
    expect(storageApi.remove).toHaveBeenCalledWith([expect.stringMatching(/^seo-og\//)]);
    expect(from.mock.calls.some(([table]) => table === "site_settings")).toBe(false);
    expect(revalidateSiteSeoSettingsCacheMock).not.toHaveBeenCalled();
  });

  it.each(incompleteSeoRowSets)(
    "reloads after %s selected SEO upsert data without deleting committed assets",
    async (_name, data) => {
      const load = seoSelectQuery({ data: seoRows, error: null });
      const save = upsertQuery({ data, error: null });
      const reload = seoSelectQuery({ data: seoRows, error: null });
      const history = historyInsertQuery({ data: { id: "new-seo-og" }, error: null });
      const historyLifecycle = historyCleanupOrUpdateQuery({ error: null });
      const retention = historySelectQuery({ data: [], error: null });
      const storageApi = storage();
      const from = fromQueue({
        site_seo_settings: [load, save, reload],
        site_asset_uploads: [history, historyLifecycle, retention],
      });
      const { saveAdminSiteSettingsSection } = await import("../admin-section-route");

      const response = await saveAdminSiteSettingsSection(
        seoRequest({ seoOgImageFile: new File(["global"], "global.webp", { type: "image/webp" }) }),
        "seo",
        { from, storage: storageApi } as never,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        verified: true,
      });
      expect(historyLifecycle.delete).not.toHaveBeenCalled();
      expect(historyLifecycle.update).toHaveBeenCalled();
      expect(retention.select).toHaveBeenCalled();
      expect(storageApi.remove).not.toHaveBeenCalled();
      expect(from).toHaveBeenCalledTimes(6);
      expect(revalidateSiteSeoSettingsCacheMock).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps uploaded SEO assets current when an incomplete representation cannot be verified", async () => {
    const load = seoSelectQuery({ data: seoRows, error: null });
    const save = upsertQuery({ data: null, error: null });
    const reload = seoSelectQuery({ data: seoRows.slice(0, 3), error: null });
    const history = historyInsertQuery({ data: { id: "new-seo-og" }, error: null });
    const historyLifecycle = historyCleanupOrUpdateQuery({ error: null });
    const retention = historySelectQuery({ data: [], error: null });
    const storageApi = storage();
    const from = fromQueue({
      site_seo_settings: [load, save, reload],
      site_asset_uploads: [history, historyLifecycle, retention],
    });
    const { saveAdminSiteSettingsSection } = await import("../admin-section-route");

    const response = await saveAdminSiteSettingsSection(
      seoRequest({ seoOgImageFile: new File(["global"], "global.webp", { type: "image/webp" }) }),
      "seo",
      { from, storage: storageApi } as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      verified: false,
      warnings: ["Settings were saved but could not be reloaded."],
    });
    expect(historyLifecycle.delete).not.toHaveBeenCalled();
    expect(historyLifecycle.update).not.toHaveBeenCalled();
    expect(retention.select).not.toHaveBeenCalled();
    expect(storageApi.remove).not.toHaveBeenCalled();
    expect(revalidateSiteSeoSettingsCacheMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["reload error", { data: null, error: { message: "reload failed" } }],
    ["incomplete reload", { data: seoRows.slice(0, 3), error: null }],
  ])(
    "returns verified false after a successful SEO upsert with %s",
    async (_name, reloadResult) => {
      const load = seoSelectQuery({ data: seoRows, error: null });
      const save = upsertQuery({ data: seoRows, error: null });
      const reload = seoSelectQuery(reloadResult);
      const from = fromQueue({ site_seo_settings: [load, save, reload] });
      const { saveAdminSiteSettingsSection } = await import("../admin-section-route");

      const response = await saveAdminSiteSettingsSection(
        seoRequest({}),
        "seo",
        { from, storage: storage() } as never,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        verified: false,
        warnings: ["Settings were saved but could not be reloaded."],
      });
      expect(revalidateSiteSeoSettingsCacheMock).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects cross-section JSON fields before persistence", async () => {
    const from = vi.fn();
    const { saveAdminSiteSettingsSection } = await import("../admin-section-route");
    const response = await saveAdminSiteSettingsSection(
      themeRequest({ primaryColor: "#112233", siteName: "Wrong section" }),
      "theme",
      { from } as never,
    );
    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rolls back earlier uploads when a later upload fails", async () => {
    const load = selectQuery({ data: brandRow, error: null });
    const storageApi = storage({ uploads: [{ error: null }, { error: { message: "upload failed" } }] });
    const { saveAdminSiteSettingsSection } = await import("../admin-section-route");

    const response = await saveAdminSiteSettingsSection(
      brandRequest({
        faviconFile: new File(["favicon"], "favicon.webp", { type: "image/webp" }),
        logo: new File(["logo"], "logo.webp", { type: "image/webp" }),
      }),
      "brand",
      { from: fromQueue({ site_settings: [load] }), storage: storageApi } as never,
    );

    expect(response.status).toBe(500);
    expect(storageApi.remove).toHaveBeenCalledWith([expect.stringMatching(/^favicon\//)]);
  });

  it("rolls back storage when upload history recording fails", async () => {
    const load = selectQuery({ data: brandRow, error: null });
    const history = historyInsertQuery({ data: null, error: { code: "42501", message: "history failed" } });
    const storageApi = storage();
    const { saveAdminSiteSettingsSection } = await import("../admin-section-route");

    const response = await saveAdminSiteSettingsSection(
      brandRequest({ logo: new File(["logo"], "logo.webp", { type: "image/webp" }) }),
      "brand",
      { from: fromQueue({ site_settings: [load], site_asset_uploads: [history] }), storage: storageApi } as never,
    );

    expect(response.status).toBe(403);
    expect(storageApi.remove).toHaveBeenCalledWith([expect.stringMatching(/^logo\//)]);
  });

  it("deletes history and storage when section persistence fails", async () => {
    const load = selectQuery({ data: brandRow, error: null });
    const history = historyInsertQuery({ data: { id: "new-logo" }, error: null });
    const save = updateQuery({ error: { message: "save failed" } });
    const historyDelete = historyDeleteQuery({ error: null });
    const storageApi = storage();
    const from = fromQueue({
      site_settings: [load, save],
      site_asset_uploads: [history, historyDelete],
    });
    const { saveAdminSiteSettingsSection } = await import("../admin-section-route");

    const response = await saveAdminSiteSettingsSection(
      brandRequest({ logo: new File(["logo"], "logo.webp", { type: "image/webp" }) }),
      "brand",
      { from, storage: storageApi } as never,
    );

    expect(response.status).toBe(500);
    expect(historyDelete.eq).toHaveBeenCalledWith("id", "new-logo");
    expect(storageApi.remove).toHaveBeenCalledWith([expect.stringMatching(/^logo\//)]);
    expect(revalidateSiteSettingsCacheMock).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(4);
  });

  it("cleans up and stops when the update affects no singleton row", async () => {
    const load = selectQuery({ data: brandRow, error: null });
    const history = historyInsertQuery({ data: { id: "new-logo" }, error: null });
    const save = updateQuery({ data: null, error: null });
    const historyDelete = historyDeleteQuery({ error: null });
    const storageApi = storage();
    const from = fromQueue({
      site_settings: [load, save],
      site_asset_uploads: [history, historyDelete],
    });
    const { saveAdminSiteSettingsSection } = await import("../admin-section-route");

    const response = await saveAdminSiteSettingsSection(
      brandRequest({ logo: new File(["logo"], "logo.webp", { type: "image/webp" }) }),
      "brand",
      { from, storage: storageApi } as never,
    );

    expect(response.status).toBe(404);
    expect(save.select).toHaveBeenCalledWith("id");
    expect(historyDelete.eq).toHaveBeenCalledWith("id", "new-logo");
    expect(storageApi.remove).toHaveBeenCalledWith([expect.stringMatching(/^logo\//)]);
    expect(revalidateSiteSettingsCacheMock).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(4);
  });

  it("returns intended values as unverified when reload errors after persistence", async () => {
    const load = selectQuery({ data: themeRow, error: null });
    const save = updateQuery({ error: null });
    const reload = selectQuery({ data: null, error: { message: "reload failed" } });
    const from = fromQueue({ site_settings: [load, save, reload] });
    const { saveAdminSiteSettingsSection } = await import("../admin-section-route");

    const response = await saveAdminSiteSettingsSection(
      themeRequest({ primaryColor: "#112233", accentColor: "#445566" }),
      "theme",
      { from, storage: storage() } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      verified: false,
      settings: { primaryColor: "#112233", accentColor: "#445566" },
      warnings: ["Settings were saved but could not be reloaded."],
    });
  });

  it("returns intended values as unverified when reload finds no row", async () => {
    const load = selectQuery({ data: themeRow, error: null });
    const save = updateQuery({ error: null });
    const reload = selectQuery({ data: null, error: null });
    const from = fromQueue({ site_settings: [load, save, reload] });
    const { saveAdminSiteSettingsSection } = await import("../admin-section-route");

    const response = await saveAdminSiteSettingsSection(
      themeRequest({ primaryColor: "#112233", accentColor: "#445566" }),
      "theme",
      { from, storage: storage() } as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      verified: false,
      settings: { primaryColor: "#112233", accentColor: "#445566" },
      warnings: ["Settings were saved but could not be reloaded."],
    });
  });

  it("returns a deduplicated warning when cache revalidation fails after persistence", async () => {
    const load = selectQuery({ data: themeRow, error: null });
    const save = updateQuery({ error: null });
    const reload = selectQuery({ data: themeRow, error: null });
    const from = fromQueue({ site_settings: [load, save, reload] });
    revalidateSiteSettingsCacheMock.mockRejectedValue(new Error("cache failed"));
    const { saveAdminSiteSettingsSection } = await import("../admin-section-route");

    const response = await saveAdminSiteSettingsSection(
      themeRequest({ primaryColor: "#064e3b", accentColor: "#eab308" }),
      "theme",
      { from, storage: storage() } as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      verified: true,
      warnings: ["Settings were saved but cache refresh failed."],
    });
  });

  it("returns one deduplicated retention warning after a successful upload", async () => {
    const load = selectQuery({ data: brandRow, error: null });
    const history = historyInsertQuery({ data: { id: "new-logo" }, error: null });
    const save = updateQuery({ error: null });
    const markInactive = historyUpdateQuery({ error: null });
    const invalidRow = {
      id: "bad", asset_type: "logo", storage_bucket: "other", storage_path: "logo/bad.webp",
      is_current: false, created_at: "2026-01-01T00:00:00.000Z",
    };
    const retention = historySelectQuery({ data: [invalidRow, { ...invalidRow, id: "bad-2" }], error: null });
    const reload = selectQuery({ data: { ...brandRow, site_name: "Updated Villas" }, error: null });
    const storageApi = storage();
    const { saveAdminSiteSettingsSection } = await import("../admin-section-route");

    const response = await saveAdminSiteSettingsSection(
      brandRequest({ logo: new File(["logo"], "logo.webp", { type: "image/webp" }) }),
      "brand",
      {
        from: fromQueue({
          site_settings: [load, save, reload],
          site_asset_uploads: [history, markInactive, retention],
        }),
        storage: storageApi,
      } as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      warnings: ["Skipped cleanup for logo upload with unexpected storage location."],
    });
    expect(revalidateSiteSettingsCacheMock).toHaveBeenCalledTimes(1);
  });
});
