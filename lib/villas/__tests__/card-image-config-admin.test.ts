import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  revalidateSiteSettingsCache,
  revalidateVillaCardImagesCache,
} from "@/lib/cache-revalidation";
import { fetchVillaCardHouseOptionPage } from "@/lib/villas/server";
import {
  buildAdminVillaCardImageConfigsResponse,
  deleteAdminVillaCardCoverImage,
  parseVillaCardImageConfigPayload,
  saveAdminVillaCardImageConfig,
  saveAdminVillaCardImages,
} from "../card-image-config-admin";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/cache-revalidation", () => ({
  revalidateSiteSettingsCache: vi.fn(),
  revalidateVillaCardImagesCache: vi.fn(),
}));

vi.mock("@/lib/villas/server", () => ({
  fetchVillaCardHouseOptionPage: vi.fn(
    (query: { page: number; pageSize: number }) =>
      Promise.resolve({
        hasMore: false,
        items: [
          {
            coverImage: null,
            id: "9",
            title: "Villa 9",
            zoneLabel: "outside",
          },
        ],
        page: query.page,
        pageSize: query.pageSize,
        total: 1,
      }),
  ),
  getListingById: vi.fn().mockResolvedValue({
    coverImage: null,
    id: "9",
    title: "Villa 9",
    zoneLabel: "outside",
  }),
}));

vi.mock("@/lib/villas/public-dto", () => ({
  toPublicVillaListings: vi.fn(
    (
      listings: Array<{
        coverImage?: string | null;
        id?: string;
        title?: string;
        zoneLabel?: string;
      }>,
    ) =>
      listings.map((listing) => ({
        coverImage: listing.coverImage ?? null,
        id: listing.id ?? "9",
        title: listing.title ?? "Villa 9",
        zoneLabel: listing.zoneLabel ?? "outside",
      })),
  ),
}));

const revalidateVillaCardImagesCacheMock = vi.mocked(
  revalidateVillaCardImagesCache,
);
const revalidateSiteSettingsCacheMock = vi.mocked(revalidateSiteSettingsCache);
const fetchVillaCardHouseOptionPageMock = vi.mocked(
  fetchVillaCardHouseOptionPage,
);

function request(body: unknown) {
  return new Request("https://example.com/api/admin/villa-card-images", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "PUT",
  });
}

function multipartRequest(formData: FormData) {
  return new Request("https://example.com/api/admin/villa-card-images", {
    body: formData,
    method: "PUT",
  });
}

describe("admin villa card image config route helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates custom image ids with the shared card image limits", () => {
    expect(
      parseVillaCardImageConfigPayload({
        houseId: "9",
        imageIds: [30, 10, 20],
      }),
    ).toEqual({
      config: {
        coverImage: null,
        houseId: "9",
        imageIds: [30, 10, 20],
        isActive: true,
        pageKey: "default",
      },
      errors: [],
    });
    expect(
      parseVillaCardImageConfigPayload({
        houseId: "9",
        imageIds: [30, 10],
      }).errors,
    ).toContain("Select at least 3 images");
  });

  it("rejects mode-only payloads because card image priority is automatic", async () => {
    const supabase = {
      from: vi.fn(),
    };

    const response = await saveAdminVillaCardImages(
      request({ mode: "custom" }),
      supabase as never,
    );

    expect(response.status).toBe(400);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(revalidateVillaCardImagesCacheMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      errors: ["houseId must be a positive house id.", "imageIds must be an array."],
    });
  });

  it("saves only the validated villa card style", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { villa_card_style: "gallery" },
      error: null,
    });
    const selectSaved = vi.fn(() => ({ maybeSingle }));
    const eq = vi.fn(() => ({ select: selectSaved }));
    const update = vi.fn(() => ({ eq }));
    const supabase = { from: vi.fn(() => ({ update })) };

    const response = await saveAdminVillaCardImages(
      request({ villaCardStyle: "gallery" }),
      supabase as never,
    );

    expect(response.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith("site_settings");
    expect(update).toHaveBeenCalledWith({ villa_card_style: "gallery" });
    expect(eq).toHaveBeenCalledWith("id", "global");
    expect(selectSaved).toHaveBeenCalledWith("villa_card_style");
    expect(revalidateSiteSettingsCacheMock).toHaveBeenCalledOnce();
    expect(revalidateVillaCardImagesCacheMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ villaCardStyle: "gallery" });
  });

  it("rejects invalid villa card styles without writing", async () => {
    const supabase = { from: vi.fn() };

    const response = await saveAdminVillaCardImages(
      request({ villaCardStyle: "custom" }),
      supabase as never,
    );

    expect(response.status).toBe(400);
    expect(supabase.from).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      errors: ["villaCardStyle must be classic or gallery."],
    });
  });

  it("loads configs without querying a removed mode column", async () => {
    const nestedOrder = vi.fn().mockResolvedValue({
      data: [
        {
          cover_image_alt: "Villa 9 cover",
          cover_image_path: "villa-cover/9/cover.webp",
          cover_image_url: "https://assets.example.com/villa-cover/9/cover.webp",
          id: "config-1",
          house_id: "9",
          is_active: true,
          page_key: "default",
          villa_card_image_items: [
            { image_id: 20, sort_order: 2 },
            { image_id: 10, sort_order: 1 },
          ],
        },
      ],
      error: null,
    });
    const houseOrder = vi.fn().mockReturnValue({ order: nestedOrder });
    const inHouse = vi.fn().mockReturnValue({ order: houseOrder });
    const eq = vi.fn().mockReturnValue({ in: inHouse });
    const select = vi.fn().mockReturnValue({ eq });
    const maybeSingleStyle = vi.fn().mockResolvedValue({
      data: { villa_card_style: "gallery" },
      error: null,
    });
    const eqStyle = vi.fn(() => ({ maybeSingle: maybeSingleStyle }));
    const selectStyle = vi.fn(() => ({ eq: eqStyle }));
    const supabase = {
      from: vi.fn((table: string) =>
        table === "site_settings" ? { select: selectStyle } : { select },
      ),
    };

    const response = await buildAdminVillaCardImageConfigsResponse(
      supabase as never,
    );

    expect(response.status).toBe(200);
    expect(fetchVillaCardHouseOptionPageMock).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      search: "",
    });
    expect(eq).toHaveBeenCalledOnce();
    expect(eq).toHaveBeenCalledWith("page_key", "default");
    expect(inHouse).toHaveBeenCalledWith("house_id", ["9"]);
    expect(houseOrder).toHaveBeenCalledWith("house_id", { ascending: true });
    expect(nestedOrder).toHaveBeenCalledWith("sort_order", {
      ascending: true,
      referencedTable: "villa_card_image_items",
    });
    await expect(response.json()).resolves.toEqual({
      configs: [
        {
          coverImage: {
            alt: "Villa 9 cover",
            path: "villa-cover/9/cover.webp",
            url: "https://assets.example.com/villa-cover/9/cover.webp",
          },
          houseId: "9",
          id: "config-1",
          imageIds: [10, 20],
          isActive: true,
          pageKey: "default",
        },
      ],
      houses: [
        {
          coverImage: null,
          id: "9",
          title: "Villa 9",
          zoneLabel: "outside",
        },
      ],
      pagination: {
        hasMore: false,
        page: 1,
        pageCount: 1,
        pageSize: 10,
        search: "",
        total: 1,
      },
      villaCardStyle: "gallery",
    });
  });

  it("loads configs for only the requested house page", async () => {
    fetchVillaCardHouseOptionPageMock.mockResolvedValueOnce({
      hasMore: true,
      items: [
        {
          coverImage: null,
          id: "9",
          title: "Villa 9",
          zoneLabel: "outside",
        },
      ],
      page: 3,
      pageSize: 25,
      total: 61,
    });
    const nestedOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const houseOrder = vi.fn().mockReturnValue({ order: nestedOrder });
    const inHouse = vi.fn().mockReturnValue({ order: houseOrder });
    const eq = vi.fn().mockReturnValue({ in: inHouse });
    const select = vi.fn().mockReturnValue({ eq });
    const maybeSingleStyle = vi.fn().mockResolvedValue({
      data: { villa_card_style: "classic" },
      error: null,
    });
    const eqStyle = vi.fn(() => ({ maybeSingle: maybeSingleStyle }));
    const selectStyle = vi.fn(() => ({ eq: eqStyle }));
    const supabase = {
      from: vi.fn((table: string) =>
        table === "site_settings" ? { select: selectStyle } : { select },
      ),
    };

    const response = await buildAdminVillaCardImageConfigsResponse(
      supabase as never,
      new Request(
        "https://example.com/api/admin/villa-card-images?page=3&pageSize=25&search=pool",
      ),
    );

    expect(response.status).toBe(200);
    expect(fetchVillaCardHouseOptionPageMock).toHaveBeenCalledWith({
      page: 3,
      pageSize: 25,
      search: "pool",
    });
    expect(inHouse).toHaveBeenCalledWith("house_id", ["9"]);
    await expect(response.json()).resolves.toEqual({
      configs: [],
      houses: [
        {
          coverImage: null,
          id: "9",
          title: "Villa 9",
          zoneLabel: "outside",
        },
      ],
      pagination: {
        hasMore: true,
        page: 3,
        pageCount: 3,
        pageSize: 25,
        search: "pool",
        total: 61,
      },
      villaCardStyle: "classic",
    });
  });

  it("replaces custom image rows in global sort order and revalidates the page config", async () => {
    const upsert = vi.fn();
    const select = vi.fn();
    const single = vi.fn().mockResolvedValue({
        data: {
          id: "config-1",
          house_id: "9",
          is_active: true,
          page_key: "default",
        },
      error: null,
    });
    const deleteItems = vi.fn();
    const eqItems = vi.fn().mockResolvedValue({ error: null });
    const insertItems = vi.fn().mockResolvedValue({ error: null });
    upsert.mockReturnValue({ select });
    select.mockReturnValue({ single });
    deleteItems.mockReturnValue({ eq: eqItems });
    const supabase = {
      from: vi.fn((table: string) =>
        table === "villa_card_image_configs"
          ? { upsert }
          : { delete: deleteItems, insert: insertItems },
      ),
    };

    const response = await saveAdminVillaCardImageConfig(
      request({
        houseId: "9",
        imageIds: [30, 10, 20],
      }),
      supabase as never,
    );

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      {
        house_id: "9",
        is_active: true,
        page_key: "default",
      },
      { onConflict: "page_key,house_id" },
    );
    expect(deleteItems).toHaveBeenCalled();
    expect(eqItems).toHaveBeenCalledWith("config_id", "config-1");
    expect(insertItems).toHaveBeenCalledWith([
      { config_id: "config-1", image_id: 30, sort_order: 1 },
      { config_id: "config-1", image_id: 10, sort_order: 2 },
      { config_id: "config-1", image_id: 20, sort_order: 3 },
    ]);
    expect(revalidateVillaCardImagesCacheMock).toHaveBeenCalledWith("9");
    await expect(response.json()).resolves.toEqual({
      config: {
        coverImage: null,
        houseId: "9",
        id: "config-1",
        imageIds: [30, 10, 20],
        isActive: true,
        pageKey: "default",
      },
    });
  });

  it("uploads a custom cover image without replacing selected gallery images", async () => {
    const file = new File(["cover"], "cover.webp", { type: "image/webp" });
    const formData = new FormData();
    formData.set("houseId", "9");
    formData.set("coverImageAlt", "Custom cover");
    formData.set("coverImage", file);

    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn(() => ({
      data: {
        publicUrl:
          "https://example.supabase.co/storage/v1/object/public/site-assets/villa-cover/9/custom.webp",
      },
    }));
    const remove = vi.fn().mockResolvedValue({ error: null });
    const upsert = vi.fn();
    const selectConfig = vi.fn();
    const singleConfig = vi.fn().mockResolvedValue({
      data: {
        cover_image_alt: "Custom cover",
        cover_image_path: "villa-cover/9/custom.webp",
        cover_image_url:
          "https://example.supabase.co/storage/v1/object/public/site-assets/villa-cover/9/custom.webp",
        id: "config-1",
        house_id: "9",
        is_active: true,
        page_key: "default",
      },
      error: null,
    });
    upsert.mockReturnValue({ select: selectConfig });
    selectConfig.mockReturnValue({ single: singleConfig });

    const insertHistory = vi.fn();
    const selectHistory = vi.fn();
    const singleHistory = vi.fn().mockResolvedValue({
      data: { id: "upload-1" },
      error: null,
    });
    insertHistory.mockReturnValue({ select: selectHistory });
    selectHistory.mockReturnValue({ single: singleHistory });

    const updateHistory = vi.fn();
    const eqAssetType = vi.fn(() => ({ eq: eqBucket }));
    const eqBucket = vi.fn(() => ({ eq: eqCurrent }));
    const eqCurrent = vi.fn(() => ({ like: likePath }));
    const likePath = vi.fn(() => ({ neq: neqUploadId }));
    const neqUploadId = vi.fn().mockResolvedValue({ error: null });
    updateHistory.mockReturnValue({ eq: eqAssetType });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "villa_card_image_configs") {
          return { upsert };
        }

        if (table === "site_asset_uploads") {
          return { insert: insertHistory, update: updateHistory };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({ getPublicUrl, remove, upload })),
      },
    };

    const response = await saveAdminVillaCardImages(
      multipartRequest(formData),
      supabase as never,
    );

    expect(response.status).toBe(200);
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^villa-cover\/9\/[0-9a-f-]+\.webp$/),
      expect.any(File),
      {
        cacheControl: "31536000",
        contentType: "image/webp",
        upsert: false,
      },
    );
    expect(upsert).toHaveBeenCalledWith(
      {
        cover_image_alt: "Custom cover",
        cover_image_path: expect.stringMatching(
          /^villa-cover\/9\/[0-9a-f-]+\.webp$/,
        ),
        cover_image_url:
          "https://example.supabase.co/storage/v1/object/public/site-assets/villa-cover/9/custom.webp",
        house_id: "9",
        is_active: true,
        page_key: "default",
      },
      { onConflict: "page_key,house_id" },
    );
    expect(insertHistory).toHaveBeenCalledWith({
      asset_type: "villa-cover",
      is_current: true,
      public_url:
        "https://example.supabase.co/storage/v1/object/public/site-assets/villa-cover/9/custom.webp",
      storage_bucket: "site-assets",
      storage_path: expect.stringMatching(/^villa-cover\/9\/[0-9a-f-]+\.webp$/),
    });
    expect(updateHistory).toHaveBeenCalledWith({ is_current: false });
    expect(likePath).toHaveBeenCalledWith("storage_path", "villa-cover/9/%");
    expect(neqUploadId).toHaveBeenCalledWith("id", "upload-1");
    expect(remove).not.toHaveBeenCalled();
    expect(revalidateVillaCardImagesCacheMock).toHaveBeenCalledWith("9");
    await expect(response.json()).resolves.toEqual({
      config: {
        coverImage: {
          alt: "Custom cover",
          path: "villa-cover/9/custom.webp",
          url: "https://example.supabase.co/storage/v1/object/public/site-assets/villa-cover/9/custom.webp",
        },
        houseId: "9",
        id: "config-1",
        imageIds: [],
        isActive: true,
        pageKey: "default",
      },
    });
  });

  it("deletes the uploaded cover image and keeps gallery image ids", async () => {
    const maybeSingleCurrent = vi.fn().mockResolvedValue({
      data: {
        cover_image_alt: "Custom cover",
        cover_image_path: "villa-cover/9/custom.webp",
        cover_image_url: "https://assets.example.com/villa-cover/9/custom.webp",
        id: "config-1",
        house_id: "9",
        is_active: true,
        page_key: "default",
        villa_card_image_items: [
          { image_id: 30, sort_order: 1 },
          { image_id: 10, sort_order: 2 },
          { image_id: 20, sort_order: 3 },
        ],
      },
      error: null,
    });
    const selectCurrent = vi.fn();
    const eqCurrentPage = vi.fn(() => ({ eq: eqCurrentHouse }));
    const eqCurrentHouse = vi.fn(() => ({ maybeSingle: maybeSingleCurrent }));
    selectCurrent.mockReturnValue({ eq: eqCurrentPage });

    const singleUpdated = vi.fn().mockResolvedValue({
      data: {
        cover_image_alt: null,
        cover_image_path: null,
        cover_image_url: null,
        id: "config-1",
        house_id: "9",
        is_active: true,
        page_key: "default",
        villa_card_image_items: [
          { image_id: 30, sort_order: 1 },
          { image_id: 10, sort_order: 2 },
          { image_id: 20, sort_order: 3 },
        ],
      },
      error: null,
    });
    const updateConfig = vi.fn();
    const eqConfigId = vi.fn(() => ({ select: selectUpdated }));
    const selectUpdated = vi.fn(() => ({ single: singleUpdated }));
    updateConfig.mockReturnValue({ eq: eqConfigId });

    const updateHistory = vi.fn();
    const eqAssetType = vi.fn(() => ({ eq: eqBucket }));
    const eqBucket = vi.fn(() => ({ eq: eqCurrent }));
    const eqCurrent = vi.fn(() => ({ like: likePath }));
    const likePath = vi.fn().mockResolvedValue({ error: null });
    updateHistory.mockReturnValue({ eq: eqAssetType });

    const remove = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "villa_card_image_configs") {
          return { select: selectCurrent, update: updateConfig };
        }

        if (table === "site_asset_uploads") {
          return { update: updateHistory };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({ remove })),
      },
    };

    const response = await deleteAdminVillaCardCoverImage(
      new Request("https://example.com/api/admin/villa-card-images?houseId=9", {
        method: "DELETE",
      }),
      supabase as never,
    );

    expect(response.status).toBe(200);
    expect(updateConfig).toHaveBeenCalledWith({
      cover_image_alt: null,
      cover_image_path: null,
      cover_image_url: null,
    });
    expect(eqConfigId).toHaveBeenCalledWith("id", "config-1");
    expect(updateHistory).toHaveBeenCalledWith({ is_current: false });
    expect(likePath).toHaveBeenCalledWith("storage_path", "villa-cover/9/%");
    expect(remove).toHaveBeenCalledWith(["villa-cover/9/custom.webp"]);
    expect(revalidateVillaCardImagesCacheMock).toHaveBeenCalledWith("9");
    await expect(response.json()).resolves.toEqual({
      config: {
        coverImage: null,
        houseId: "9",
        id: "config-1",
        imageIds: [30, 10, 20],
        isActive: true,
        pageKey: "default",
      },
    });
  });
});
