import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertHomeConfigAdmin,
  getBearerToken,
  jsonError,
} from "@/lib/admin/home-config-auth";
import { SITE_SETTINGS_ID } from "../defaults";

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

vi.mock("@/lib/site-settings/defaults", async () => import("../defaults"));
vi.mock("@/lib/site-settings/validation", async () => import("../validation"));

const assertHomeConfigAdminMock = vi.mocked(assertHomeConfigAdmin);
const getBearerTokenMock = vi.mocked(getBearerToken);
const jsonErrorMock = vi.mocked(jsonError);

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
};

function siteSettingsSelectQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });

  return { eq, maybeSingle, select };
}

function siteSettingsUpsertQuery(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const upsert = vi.fn().mockReturnValue({ select });

  return { select, single, upsert };
}

function uploadHistorySelectQuery(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ order });

  return { order, select };
}

function authenticatedRequest() {
  return new Request("https://example.com/api/admin/site-settings", {
    headers: { authorization: "Bearer token" },
  });
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

    assertHomeConfigAdminMock.mockResolvedValue({
      ok: true,
      supabase: { from },
    } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);

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
      },
    });
    expect(from).toHaveBeenCalledWith("site_settings");
    expect(siteSettingsQuery.eq).toHaveBeenCalledWith("id", SITE_SETTINGS_ID);
  });

  it("preserves existing image fields when PUT has no files", async () => {
    const loadQuery = siteSettingsSelectQuery({ data: dbRow, error: null });
    const saveQuery = siteSettingsUpsertQuery({
      data: {
        ...dbRow,
        site_name: "Updated Villas",
        primary_color: "#123abc",
        accent_color: "#fedcba",
        hero_image_alt: "Updated hero",
      },
      error: null,
    });
    const historyQuery = uploadHistorySelectQuery({ data: [], error: null });
    const from = vi.fn((table: string) => {
      if (table === "site_settings" && from.mock.calls.length === 1) {
        return loadQuery;
      }

      if (table === "site_settings") {
        return saveQuery;
      }

      return historyQuery;
    });

    assertHomeConfigAdminMock.mockResolvedValue({
      ok: true,
      supabase: { from },
    } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);

    const formData = new FormData();
    formData.set("siteName", " Updated Villas ");
    formData.set("primaryColor", " #123ABC ");
    formData.set("accentColor", " #FEDCBA ");
    formData.set("heroImageAlt", " Updated hero ");

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/site-settings/route"
    );
    const response = await PUT(
      new Request("https://example.com/api/admin/site-settings", {
        body: formData,
        headers: { authorization: "Bearer token" },
        method: "PUT",
      }),
    );

    expect(saveQuery.upsert).toHaveBeenCalledWith(
      {
        id: SITE_SETTINGS_ID,
        site_name: "Updated Villas",
        primary_color: "#123abc",
        accent_color: "#fedcba",
        logo_image_path: "logo/2026/05/logo.webp",
        logo_image_url: "https://example.com/logo.webp",
        hero_image_path: "hero/2026/05/hero.webp",
        hero_image_url: "https://example.com/hero.webp",
        hero_image_alt: "Updated hero",
      },
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
      },
      warnings: [],
    });
    expect(jsonErrorMock).not.toHaveBeenCalled();
  });
});
