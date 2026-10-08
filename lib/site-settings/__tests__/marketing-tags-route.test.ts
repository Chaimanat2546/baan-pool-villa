import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertHomeConfigAdmin,
  getBearerToken,
} from "@/lib/admin/home-config-auth";
import { revalidateSiteSettingsCache } from "@/lib/cache-revalidation";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/admin/home-config-auth", () => ({
  assertHomeConfigAdmin: vi.fn(),
  getBearerToken: vi.fn(),
  jsonError: vi.fn(
    (message: string, status: number, extra?: Record<string, string | null | undefined>) =>
      Response.json({ error: message, ...extra }, { status }),
  ),
}));

vi.mock("@/lib/cache-revalidation", () => ({
  revalidateSiteSettingsCache: vi.fn(),
}));

vi.mock("@/lib/site-settings/defaults", async () => import("../defaults"));
vi.mock("@/lib/site-settings/validation", async () => import("../validation"));

const assertHomeConfigAdminMock = vi.mocked(assertHomeConfigAdmin);
const getBearerTokenMock = vi.mocked(getBearerToken);
const revalidateSiteSettingsCacheMock = vi.mocked(revalidateSiteSettingsCache);

const dbRow = {
  id: "global",
  google_tag_manager_id: " gtm-abc1234 ",
};

function siteSettingsSelectQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });

  return { eq, maybeSingle, select };
}

function siteSettingsUpdateQuery(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });

  return { eq, select, single, update };
}

function siteSettingsInsertQuery(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });

  return { insert, select, single };
}

function fromQueue(queues: Record<string, unknown[]>) {
  return vi.fn((table: string) => {
    const queue = queues[table];

    if (!queue || queue.length === 0) {
      throw new Error(`Unexpected Supabase table call: ${table}`);
    }

    const query = queue.shift();

    if (!query) {
      throw new Error(`Unexpected Supabase query for: ${table}`);
    }

    return query;
  });
}

function authSupabase(supabase: unknown) {
  assertHomeConfigAdminMock.mockResolvedValue({
    ok: true,
    supabase,
  } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);
}

function authenticatedRequest() {
  return new Request("https://example.com/api/admin/marketing-tags", {
    headers: { authorization: "Bearer token" },
  });
}

function marketingTagsForm(googleTagManagerId = "GTM-ABC1234") {
  const formData = new FormData();
  formData.set("googleTagManagerId", googleTagManagerId);

  return formData;
}

function putRequest(formData: FormData) {
  return new Request("https://example.com/api/admin/marketing-tags", {
    body: formData,
    headers: { authorization: "Bearer token", origin: "https://example.com" },
    method: "PUT",
  });
}

describe("admin marketing tags route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getBearerTokenMock.mockReturnValue("token");
  });

  it("returns normalized marketing tag settings with tracking surfaces", async () => {
    const query = siteSettingsSelectQuery({ data: dbRow, error: null });
    const from = vi.fn().mockReturnValue(query);

    authSupabase({ from });

    const { GET } = await import("../../../app/(admin)/api/admin/marketing-tags/route");
    const response = await GET(authenticatedRequest());

    await expect(response.json()).resolves.toMatchObject({
      settings: {
        googleTagManagerId: "GTM-ABC1234",
      },
      source: "config",
      trackingSurfaces: expect.arrayContaining([
        expect.objectContaining({
          path: "/villas/[id]",
          status: "ready",
        }),
      ]),
    });
    expect(query.select).toHaveBeenCalledWith("id,google_tag_manager_id");
    expect(query.eq).toHaveBeenCalledWith("id", "global");
  });

  it("rejects non-GTM code without calling Supabase", async () => {
    const from = vi.fn();
    authSupabase({ from });

    const { PUT } = await import("../../../app/(admin)/api/admin/marketing-tags/route");
    const response = await PUT(
      putRequest(marketingTagsForm("<script>alert(1)</script>")),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: [
        "GTM ID ต้องอยู่ในรูปแบบ GTM-XXXXXXX และใช้ได้เฉพาะตัวอักษร A-Z กับตัวเลข",
      ],
    });
    expect(from).not.toHaveBeenCalled();
    expect(revalidateSiteSettingsCacheMock).not.toHaveBeenCalled();
  });

  it("updates only the Google Tag Manager ID column", async () => {
    const saveQuery = siteSettingsUpdateQuery({
      data: { id: "global", google_tag_manager_id: "GTM-ABC1234" },
      error: null,
    });
    const from = fromQueue({
      site_settings: [saveQuery],
    });

    authSupabase({ from });

    const { PUT } = await import("../../../app/(admin)/api/admin/marketing-tags/route");
    const response = await PUT(putRequest(marketingTagsForm(" gtm-abc1234 ")));

    expect(saveQuery.update).toHaveBeenCalledWith({
      google_tag_manager_id: "GTM-ABC1234",
    });
    expect(saveQuery.select).toHaveBeenCalledWith("id,google_tag_manager_id");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      settings: { googleTagManagerId: "GTM-ABC1234" },
      source: "config",
    });
    expect(revalidateSiteSettingsCacheMock).toHaveBeenCalledTimes(1);
  });

  it("inserts the global settings row when saving before settings exist", async () => {
    const noRowsError = {
      code: "PGRST116",
      message: "JSON object requested, multiple (or no) rows returned",
    };
    const updateQuery = siteSettingsUpdateQuery({ data: null, error: noRowsError });
    const insertQuery = siteSettingsInsertQuery({
      data: { id: "global", site_name: "Pool Villas Pattaya", google_tag_manager_id: "" },
      error: null,
    });
    const from = fromQueue({
      site_settings: [updateQuery, insertQuery],
    });

    authSupabase({ from });

    const { PUT } = await import("../../../app/(admin)/api/admin/marketing-tags/route");
    const response = await PUT(putRequest(marketingTagsForm("")));

    expect(insertQuery.insert).toHaveBeenCalledWith({
      id: "global",
      site_name: "Pool Villas Pattaya",
      google_tag_manager_id: "",
    });
    expect(response.status).toBe(200);
  });
});
