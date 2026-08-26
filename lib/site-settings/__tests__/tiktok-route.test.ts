import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertHomeConfigAdmin,
  getBearerToken,
} from "@/lib/admin/home-config-auth";
import { revalidateSiteSettingsCache } from "@/lib/cache-revalidation";
import { fetchHouseListings } from "@/lib/villas/server";

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

vi.mock("@/lib/villas/server", () => ({
  fetchHouseListings: vi.fn(),
}));

vi.mock("@/lib/site-settings/defaults", async () => import("../defaults"));
vi.mock("@/lib/site-settings/validation", async () => import("../validation"));

const assertHomeConfigAdminMock = vi.mocked(assertHomeConfigAdmin);
const getBearerTokenMock = vi.mocked(getBearerToken);
const revalidateSiteSettingsCacheMock = vi.mocked(revalidateSiteSettingsCache);
const fetchHouseListingsMock = vi.mocked(fetchHouseListings);

const dbRow = {
  id: "global",
  tiktok_account_url: " https://www.tiktok.com/@baanpoolvilla ",
  tiktok_video_urls: [
    "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
    "https://www.tiktok.com/player/v1/7370000000000000002",
  ],
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
  return new Request("https://example.com/api/admin/tiktok", {
    headers: { authorization: "Bearer token" },
  });
}

function tiktokSettingsForm(overrides: { tiktokAccountUrl?: string; tiktokVideoUrls?: string } = {}) {
  const formData = new FormData();
  formData.set(
    "tiktokAccountUrl",
    overrides.tiktokAccountUrl ??
      "https://www.tiktok.com/@baanpoolvilla",
  );
  formData.set(
    "tiktokVideoUrls",
    overrides.tiktokVideoUrls ??
      JSON.stringify([
        "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
        "https://www.tiktok.com/player/v1/7370000000000000002",
      ]),
  );

  return formData;
}

function putRequest(formData: FormData) {
  return new Request("https://example.com/api/admin/tiktok", {
    body: formData,
    headers: { authorization: "Bearer token", origin: "https://example.com" },
    method: "PUT",
  });
}

describe("admin tikTok route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getBearerTokenMock.mockReturnValue("token");
    fetchHouseListingsMock.mockResolvedValue([]);
  });

  it("returns 401 when bearer token is missing and does not call admin auth", async () => {
    getBearerTokenMock.mockReturnValue(null);

    const { GET } = await import("../../../app/(admin)/api/admin/tiktok/route");
    const response = await GET(authenticatedRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Missing bearer token.",
      code: "session_invalid",
    });
    expect(assertHomeConfigAdminMock).not.toHaveBeenCalled();
  });

  it("returns normalized TikTok settings with config source", async () => {
    const query = siteSettingsSelectQuery({ data: dbRow, error: null });
    const from = vi.fn().mockReturnValue(query);

    authSupabase({ from });

    const { GET } = await import("../../../app/(admin)/api/admin/tiktok/route");
    const response = await GET(authenticatedRequest());
    await expect(response.json()).resolves.toEqual({
      settings: {
        accountUrl: "https://www.tiktok.com/@baanpoolvilla",
        videos: [
          {
            url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
            videoId: "7370000000000000001",
            houseId: null,
          },
          {
            url: "https://www.tiktok.com/player/v1/7370000000000000002",
            videoId: "7370000000000000002",
            houseId: null,
          },
        ],
      },
      source: "config",
    });
    expect(from).toHaveBeenCalledWith("site_settings");
    expect(query.select).toHaveBeenCalledWith("id,tiktok_account_url,tiktok_video_urls");
    expect(query.eq).toHaveBeenCalledWith("id", "global");
  });

  it("returns the current villa title for a linked TikTok video", async () => {
    const query = siteSettingsSelectQuery({
      data: {
        ...dbRow,
        tiktok_video_urls: [
          {
            houseId: "141",
            url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
          },
        ],
      },
      error: null,
    });
    const from = vi.fn().mockReturnValue(query);
    authSupabase({ from });
    fetchHouseListingsMock.mockResolvedValue([
      {
        amenities: [],
        bathrooms: 2,
        bedrooms: 3,
        coverImage: null,
        distanceToSea: "500m",
        id: "141",
        people: 8,
        poolType: "private",
        price: 5000,
        title: "Loft House 6A",
        zone: "jomtien",
        zoneLabel: "Jomtien",
      },
    ]);

    const { GET } = await import("../../../app/(admin)/api/admin/tiktok/route");
    const response = await GET(authenticatedRequest());

    await expect(response.json()).resolves.toMatchObject({
      settings: {
        videos: [
          {
            houseId: "141",
            villaTitle: "Loft House 6A",
          },
        ],
      },
    });
  });

  it("falls back gracefully when TikTok columns are missing", async () => {
    const missingColumnError = {
      message: "column site_settings.tiktok_account_url does not exist",
      code: "42703",
    };
    const primaryQuery = siteSettingsSelectQuery({
      data: null,
      error: missingColumnError,
    });
    const fallbackQuery = siteSettingsSelectQuery({ data: { id: "global" }, error: null });
    const from = fromQueue({
      site_settings: [primaryQuery, fallbackQuery],
    });

    authSupabase({ from });

    const { GET } = await import("../../../app/(admin)/api/admin/tiktok/route");
    const response = await GET(authenticatedRequest());

    await expect(response.json()).resolves.toEqual({
      settings: {
        accountUrl: "",
        videos: [],
      },
      source: "fallback",
    });
    expect(fallbackQuery.select).toHaveBeenCalledWith("id");
  });

  it("returns 400 for invalid TikTok account or video URLs", async () => {
    authSupabase({ from: vi.fn() });

    const { PUT } = await import("../../../app/(admin)/api/admin/tiktok/route");
    const response = await PUT(
      putRequest(
        tiktokSettingsForm({
          tiktokAccountUrl: "https://example.com/@baanpoolvilla",
          tiktokVideoUrls: JSON.stringify(["https://vm.tiktok.com/ZMabc123"]),
        }),
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: [
        "ลิงก์บัญชี TikTok ต้องเป็น URL โปรไฟล์ TikTok เช่น https://www.tiktok.com/@baanpoolvilla",
        "ลิงก์วิดีโอ TikTok รายการที่ 1 ต้องเป็นลิงก์วิดีโอแบบเต็ม เช่น https://www.tiktok.com/@account/video/1234567890",
      ],
    });
  });

  it("returns 400 when TikTok video field is JSON but not an array", async () => {
    const from = vi.fn();
    authSupabase({ from });

    const { PUT } = await import("../../../app/(admin)/api/admin/tiktok/route");
    const response = await PUT(
      putRequest(
        tiktokSettingsForm({
          tiktokVideoUrls: JSON.stringify("https://example.com/not-a-list"),
        }),
      ),
    );

    expect(response.status).toBe(400);

    const body = await response.json();

    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toContain("TikTok");
    expect(body.errors[0]).toContain("รายการวิดีโอ");
    expect(from).not.toHaveBeenCalled();
    expect(revalidateSiteSettingsCacheMock).not.toHaveBeenCalled();
  });

  it("returns 400 when TikTok video list contains non-string items", async () => {
    const from = vi.fn();
    authSupabase({ from });

    const { PUT } = await import("../../../app/(admin)/api/admin/tiktok/route");
    const response = await PUT(
      putRequest(
        tiktokSettingsForm({
          tiktokAccountUrl: "https://www.tiktok.com/@baanpoolvilla",
          tiktokVideoUrls: JSON.stringify([123]),
        }),
      ),
    );

    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body.errors[0]).toContain("รายการวิดีโอ TikTok");
    expect(from).not.toHaveBeenCalled();
    expect(revalidateSiteSettingsCacheMock).not.toHaveBeenCalled();
  });

  it("returns 400 when TikTok video list is plain text", async () => {
    const from = vi.fn();
    authSupabase({ from });

    const formData = tiktokSettingsForm();
    formData.set("tiktokVideoUrls", "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001");

    const { PUT } = await import("../../../app/(admin)/api/admin/tiktok/route");
    const response = await PUT(putRequest(formData));

    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body.errors[0]).toContain("รายการวิดีโอ TikTok");
    expect(from).not.toHaveBeenCalled();
    expect(revalidateSiteSettingsCacheMock).not.toHaveBeenCalled();
  });

  it("returns 400 when TikTok video list is a File", async () => {
    const from = vi.fn();
    authSupabase({ from });

    const formData = tiktokSettingsForm();
    formData.set("tiktokVideoUrls", new File(["https://www.tiktok.com/@baanpoolvilla"], "videos.txt", {
      type: "text/plain",
    }));

    const { PUT } = await import("../../../app/(admin)/api/admin/tiktok/route");
    const response = await PUT(putRequest(formData));

    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body.errors[0]).toContain("ต้องเป็นข้อความ");
    expect(from).not.toHaveBeenCalled();
    expect(revalidateSiteSettingsCacheMock).not.toHaveBeenCalled();
  });

  it("returns 400 when TikTok video list has duplicate fields", async () => {
    const from = vi.fn();
    authSupabase({ from });

    const formData = new FormData();
    formData.set("tiktokAccountUrl", "https://www.tiktok.com/@baanpoolvilla");
    formData.append("tiktokVideoUrls", "");
    formData.append(
      "tiktokVideoUrls",
      new File(["https://www.tiktok.com/@baanpoolvilla/video/7370000000000000002"], "video.txt", {
        type: "text/plain",
      }),
    );

    const { PUT } = await import("../../../app/(admin)/api/admin/tiktok/route");
    const response = await PUT(putRequest(formData));

    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body.errors[0]).toContain("tiktokVideoUrls");
    expect(from).not.toHaveBeenCalled();
    expect(revalidateSiteSettingsCacheMock).not.toHaveBeenCalled();
  });

  it("returns 400 when TikTok account URL has duplicate fields", async () => {
    const from = vi.fn();
    authSupabase({ from });

    const formData = tiktokSettingsForm();
    formData.append("tiktokAccountUrl", "https://www.tiktok.com/@anotheraccount");

    const { PUT } = await import("../../../app/(admin)/api/admin/tiktok/route");
    const response = await PUT(putRequest(formData));

    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body.errors[0]).toContain("tiktokAccountUrl");
    expect(from).not.toHaveBeenCalled();
    expect(revalidateSiteSettingsCacheMock).not.toHaveBeenCalled();
  });

  it("returns 400 when TikTok account URL is a File", async () => {
    const from = vi.fn();
    authSupabase({ from });

    const formData = tiktokSettingsForm();
    formData.set("tiktokAccountUrl", new File(["https://www.tiktok.com/@baanpoolvilla"], "account.txt", {
      type: "text/plain",
    }));

    const { PUT } = await import("../../../app/(admin)/api/admin/tiktok/route");
    const response = await PUT(putRequest(formData));

    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body.errors[0]).toContain("tiktokAccountUrl");
    expect(from).not.toHaveBeenCalled();
    expect(revalidateSiteSettingsCacheMock).not.toHaveBeenCalled();
  });

  it("updates only TikTok columns and preserves all video URLs", async () => {
    const saveQuery = siteSettingsUpdateQuery({
      data: {
        ...dbRow,
        tiktok_account_url: "https://www.tiktok.com/@baanpoolvilla",
        tiktok_video_urls: [
          "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
          "https://www.tiktok.com/player/v1/7370000000000000002",
          "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000003",
          "https://www.tiktok.com/player/v1/7370000000000000004",
          "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000005",
        ],
      },
      error: null,
    });
    const from = fromQueue({
      site_settings: [saveQuery],
    });

    authSupabase({ from });

    const { PUT } = await import("../../../app/(admin)/api/admin/tiktok/route");
    const response = await PUT(
      putRequest(
        tiktokSettingsForm({
          tiktokAccountUrl: " https://www.tiktok.com/@baanpoolvilla ",
          tiktokVideoUrls: JSON.stringify([
            "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
            "https://www.tiktok.com/player/v1/7370000000000000002",
            "",
            "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000003",
            "https://www.tiktok.com/player/v1/7370000000000000004",
            "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000005",
          ]),
        }),
      ),
    );

    const expectedPayload = {
      tiktok_account_url: "https://www.tiktok.com/@baanpoolvilla",
      tiktok_video_urls: [
        { url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001" },
        { url: "https://www.tiktok.com/player/v1/7370000000000000002" },
        { url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000003" },
        { url: "https://www.tiktok.com/player/v1/7370000000000000004" },
        { url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000005" },
      ],
    };

    expect(saveQuery.update).toHaveBeenCalledWith(expectedPayload);
    expect(saveQuery.eq).toHaveBeenCalledWith("id", "global");
    expect(saveQuery.select).toHaveBeenCalledWith("id,tiktok_account_url,tiktok_video_urls");
    expect(saveQuery.single).toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      settings: {
        accountUrl: "https://www.tiktok.com/@baanpoolvilla",
        videos: expect.any(Array),
      },
    });
    expect(fetchHouseListingsMock).not.toHaveBeenCalled();
    expect(revalidateSiteSettingsCacheMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a linked house ID that is absent from the current catalog", async () => {
    const from = vi.fn();
    authSupabase({ from });
    fetchHouseListingsMock.mockResolvedValue([
      {
        amenities: [],
        bathrooms: 2,
        bedrooms: 3,
        coverImage: null,
        distanceToSea: "500m",
        id: "501",
        people: 8,
        poolType: "private",
        price: 5000,
        title: "Glass House B8",
        zone: "jomtien",
        zoneLabel: "Jomtien",
      },
    ]);

    const { PUT } = await import("../../../app/(admin)/api/admin/tiktok/route");
    const response = await PUT(
      putRequest(
        tiktokSettingsForm({
          tiktokVideoUrls: JSON.stringify([
            {
              houseId: "999",
              title: "Untrusted browser title",
              url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
            },
          ]),
        }),
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      errors: [expect.stringContaining("ไม่พบบ้านพักหมายเลข 999")],
    });
    expect(from).not.toHaveBeenCalled();
    expect(revalidateSiteSettingsCacheMock).not.toHaveBeenCalled();
  });

  it("returns a structured Thai error when linked-house validation cannot load the catalog", async () => {
    const from = vi.fn();
    authSupabase({ from });
    fetchHouseListingsMock.mockRejectedValue(new Error("catalog offline"));

    const { PUT } = await import("../../../app/(admin)/api/admin/tiktok/route");
    const response = await PUT(
      putRequest(
        tiktokSettingsForm({
          tiktokVideoUrls: JSON.stringify([
            {
              houseId: "501",
              url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
            },
          ]),
        }),
      ),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      errors: [expect.stringContaining("ไม่สามารถ")],
    });
    expect(from).not.toHaveBeenCalled();
    expect(revalidateSiteSettingsCacheMock).not.toHaveBeenCalled();
  });

  it.each(["abc", "001"])(
    "rejects the nonempty malformed house ID %s instead of saving it as unlinked",
    async (houseId) => {
      const saveQuery = siteSettingsUpdateQuery({
        data: {
          ...dbRow,
          tiktok_video_urls: [],
        },
        error: null,
      });
      const from = fromQueue({ site_settings: [saveQuery] });
      authSupabase({ from });
      fetchHouseListingsMock.mockResolvedValue([
        {
          amenities: [],
          bathrooms: 2,
          bedrooms: 3,
          coverImage: null,
          distanceToSea: "500m",
          id: "501",
          people: 8,
          poolType: "private",
          price: 5000,
          title: "Glass House B8",
          zone: "jomtien",
          zoneLabel: "Jomtien",
        },
      ]);

      const { PUT } = await import("../../../app/(admin)/api/admin/tiktok/route");
      const response = await PUT(
        putRequest(
          tiktokSettingsForm({
            tiktokVideoUrls: JSON.stringify([
              {
                houseId,
                url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
              },
            ]),
          }),
        ),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        errors: [expect.stringContaining(`ไม่พบบ้านพักหมายเลข ${houseId}`)],
      });
      expect(saveQuery.update).not.toHaveBeenCalled();
      expect(revalidateSiteSettingsCacheMock).not.toHaveBeenCalled();
    },
  );

  it("stores only a validated house ID without a browser-submitted title", async () => {
    const saveQuery = siteSettingsUpdateQuery({
      data: {
        ...dbRow,
        tiktok_video_urls: [
          {
            houseId: "501",
            url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
          },
        ],
      },
      error: null,
    });
    const from = fromQueue({ site_settings: [saveQuery] });
    authSupabase({ from });
    fetchHouseListingsMock.mockResolvedValue([
      {
        amenities: [],
        bathrooms: 2,
        bedrooms: 3,
        coverImage: null,
        distanceToSea: "500m",
        id: "501",
        people: 8,
        poolType: "private",
        price: 5000,
        title: "Glass House B8",
        zone: "jomtien",
        zoneLabel: "Jomtien",
      },
    ]);

    const { PUT } = await import("../../../app/(admin)/api/admin/tiktok/route");
    await PUT(
      putRequest(
        tiktokSettingsForm({
          tiktokVideoUrls: JSON.stringify([
            {
              houseId: " 501 ",
              title: "Untrusted browser title",
              url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
            },
          ]),
        }),
      ),
    );

    expect(saveQuery.update).toHaveBeenCalledWith({
      tiktok_account_url: "https://www.tiktok.com/@baanpoolvilla",
      tiktok_video_urls: [
        {
          houseId: "501",
          url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
        },
      ],
    });
  });

  it("inserts a default site name when saving TikTok settings before the global row exists", async () => {
    const noRowsError = {
      message: "JSON object requested, multiple (or no) rows returned",
      code: "PGRST116",
    };
    const updateQuery = siteSettingsUpdateQuery({ data: null, error: noRowsError });
    const insertQuery = siteSettingsInsertQuery({
      data: {
        ...dbRow,
        site_name: "Pool Villas Pattaya",
        tiktok_account_url: "https://www.tiktok.com/@baanpoolvilla",
        tiktok_video_urls: [
          "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
        ],
      },
      error: null,
    });
    const from = fromQueue({
      site_settings: [updateQuery, insertQuery],
    });

    authSupabase({ from });

    const { PUT } = await import("../../../app/(admin)/api/admin/tiktok/route");
    const response = await PUT(
      putRequest(
        tiktokSettingsForm({
          tiktokAccountUrl: "https://www.tiktok.com/@baanpoolvilla",
          tiktokVideoUrls: JSON.stringify([
            "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001",
          ]),
        }),
      ),
    );

    expect(updateQuery.update).toHaveBeenCalledWith({
      tiktok_account_url: "https://www.tiktok.com/@baanpoolvilla",
      tiktok_video_urls: [
        { url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001" },
      ],
    });
    expect(insertQuery.insert).toHaveBeenCalledWith({
      id: "global",
      site_name: "Pool Villas Pattaya",
      tiktok_account_url: "https://www.tiktok.com/@baanpoolvilla",
      tiktok_video_urls: [
        { url: "https://www.tiktok.com/@baanpoolvilla/video/7370000000000000001" },
      ],
    });
    expect(response.status).toBe(200);
    expect(revalidateSiteSettingsCacheMock).toHaveBeenCalledTimes(1);
  });

  it("returns a schema error without revalidating when save fails", async () => {
    const saveError = {
      message: "column site_settings.tiktok_account_url does not exist",
      code: "42703",
      details: "column not found",
      hint: "migrate schema",
    };
    const saveQuery = siteSettingsUpdateQuery({ data: null, error: saveError });
    const from = fromQueue({
      site_settings: [saveQuery],
    });

    authSupabase({ from });

    const { PUT } = await import("../../../app/(admin)/api/admin/tiktok/route");
    const response = await PUT(
      putRequest(
        tiktokSettingsForm({
          tiktokAccountUrl: "https://www.tiktok.com/@baanpoolvilla",
        }),
      ),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: saveError.message,
      code: saveError.code,
      details: saveError.details,
      hint: saveError.hint,
    });
    expect(revalidateSiteSettingsCacheMock).not.toHaveBeenCalled();
  });

  it("preserves Supabase permission status and payload details", async () => {
    const saveError = {
      message: "permission denied for table site_settings",
      code: "42501",
      details: "RLS denied update",
      hint: "check admin policy",
    };
    const saveQuery = siteSettingsUpdateQuery({ data: null, error: saveError });
    const from = fromQueue({
      site_settings: [saveQuery],
    });

    authSupabase({ from });

    const { PUT } = await import("../../../app/(admin)/api/admin/tiktok/route");
    const response = await PUT(
      putRequest(
        tiktokSettingsForm({
          tiktokAccountUrl: "https://www.tiktok.com/@baanpoolvilla",
        }),
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: saveError.message,
      code: saveError.code,
      details: saveError.details,
      hint: saveError.hint,
    });
    expect(revalidateSiteSettingsCacheMock).not.toHaveBeenCalled();
  });

  it("returns 400 when form data cannot be read as multipart/form-data", async () => {
    const { PUT } = await import("../../../app/(admin)/api/admin/tiktok/route");

    const request = new Request("https://example.com/api/admin/tiktok", {
      method: "PUT",
      headers: { authorization: "Bearer token", origin: "https://example.com" },
      body: "{}",
    });

    authSupabase({ from: vi.fn() });
    const response = await PUT(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: ["Request body must be multipart/form-data."],
    });
  });
});
