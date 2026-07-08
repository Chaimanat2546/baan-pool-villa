import { beforeEach, describe, expect, it, vi } from "vitest";

import { revalidateVillaCardImagesCache } from "@/lib/cache-revalidation";
import { fetchVillaCardHouseOptionPage } from "@/lib/villas/server";
import {
  buildAdminVillaCardImageConfigsResponse,
  parseVillaCardImageConfigPayload,
  saveAdminVillaCardImageConfig,
  saveAdminVillaCardImages,
} from "../card-image-config-admin";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/cache-revalidation", () => ({
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

  it("loads configs without querying a removed mode column", async () => {
    const nestedOrder = vi.fn().mockResolvedValue({
      data: [
        {
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
    const supabase = {
      from: vi.fn(() => ({ select })),
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
    const supabase = {
      from: vi.fn(() => ({ select })),
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
        houseId: "9",
        id: "config-1",
        imageIds: [30, 10, 20],
        isActive: true,
        pageKey: "default",
      },
    });
  });
});
