import type {
  HomeConfigSupabaseClient,
  SupabaseLikeError,
} from "@/lib/admin/route-helpers";
import { adminSupabaseErrorResponse } from "@/lib/admin/route-helpers";
import { revalidateVillaCardImagesCache } from "@/lib/cache-revalidation";
import { validateCustomDisplayImageIds } from "@/lib/villas/images";
import { toPublicVillaListings } from "@/lib/villas/public-dto";
import {
  fetchVillaCardHouseOptionPage,
  getListingById,
} from "@/lib/villas/server";

export const VILLA_CARD_IMAGE_CONFIG_SELECT =
  "id,page_key,house_id,is_active,villa_card_image_items(image_id,sort_order)";

interface VillaCardImageConfigRow {
  id: unknown;
  page_key: unknown;
  house_id: unknown;
  is_active: unknown;
  villa_card_image_items?: unknown;
}

interface VillaCardImageItemRow {
  image_id: unknown;
  sort_order: unknown;
}

export interface AdminVillaCardImageConfig {
  houseId: string;
  id: string;
  imageIds: number[];
  isActive: boolean;
  pageKey: string;
}

export interface AdminVillaCardHouseOption {
  coverImage: string | null;
  id: string;
  title: string;
  zoneLabel: string;
}

export interface AdminVillaCardHousePagination {
  hasMore: boolean;
  page: number;
  pageCount: number;
  pageSize: number;
  search: string;
  total: number;
}

type ParsedVillaCardImageConfigPayload =
  | {
      config: Omit<AdminVillaCardImageConfig, "id">;
      errors: [];
    }
  | {
      config: null;
      errors: string[];
    };

const VILLA_CARD_IMAGE_CONFIG_PAGE_KEY = "default";
const DEFAULT_HOUSE_PAGE = 1;
const DEFAULT_HOUSE_PAGE_SIZE = 10;
const MAX_HOUSE_PAGE_SIZE = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toImageIds(value: unknown, errors: string[]): number[] {
  if (!Array.isArray(value)) {
    errors.push("imageIds must be an array.");
    return [];
  }

  const imageIds = value.map((item) =>
    typeof item === "number" && Number.isInteger(item) ? item : 0,
  );

  if (imageIds.some((imageId) => imageId < 1)) {
    errors.push("imageIds must contain positive integer ids.");
    return [];
  }

  return imageIds;
}

function mapConfigItems(items: unknown): number[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return [...items]
    .map((item) => {
      const row = item as VillaCardImageItemRow;

      return {
        imageId: typeof row.image_id === "number" ? row.image_id : 0,
        sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
      };
    })
    .filter((item) => item.imageId > 0 && item.sortOrder >= 1)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => item.imageId);
}

export function mapVillaCardImageConfigRow(
  row: VillaCardImageConfigRow,
): AdminVillaCardImageConfig {
  if (
    typeof row.id !== "string" ||
    typeof row.page_key !== "string" ||
    typeof row.house_id !== "string" ||
    typeof row.is_active !== "boolean"
  ) {
    throw new Error("Invalid villa card image config row");
  }

  return {
    houseId: row.house_id,
    id: row.id,
    imageIds: mapConfigItems(row.villa_card_image_items),
    isActive: row.is_active,
    pageKey: row.page_key,
  };
}

export function parseVillaCardImageConfigPayload(
  payload: unknown,
): ParsedVillaCardImageConfigPayload {
  if (!isRecord(payload)) {
    return { config: null, errors: ["Body must be an object."] };
  }

  const errors: string[] = [];
  const pageKey = VILLA_CARD_IMAGE_CONFIG_PAGE_KEY;
  const houseId = typeof payload.houseId === "string" ? payload.houseId.trim() : "";
  const isActive =
    typeof payload.isActive === "boolean" ? payload.isActive : true;

  if (!/^[1-9]\d*$/.test(houseId)) {
    errors.push("houseId must be a positive house id.");
  }

  const imageIds = toImageIds(payload.imageIds, errors);

  if (errors.length === 0) {
    try {
      validateCustomDisplayImageIds(imageIds);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Invalid image ids");
    }
  }

  if (errors.length > 0) {
    return { config: null, errors };
  }

  return {
    config: {
      houseId,
      imageIds,
      isActive,
      pageKey,
    },
    errors: [],
  };
}

function toPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function toHousePageSize(value: string | null): number {
  return Math.min(
    MAX_HOUSE_PAGE_SIZE,
    toPositiveInt(value, DEFAULT_HOUSE_PAGE_SIZE),
  );
}

function toHouseOption(
  listing: ReturnType<typeof toPublicVillaListings>[number],
): AdminVillaCardHouseOption {
  return {
    coverImage: listing.coverImage,
    id: listing.id,
    title: listing.title ?? `บ้าน ${listing.id}`,
    zoneLabel: listing.zoneLabel,
  };
}

async function mapVillaCardHouseOptions(request?: Request): Promise<{
  houses: AdminVillaCardHouseOption[];
  pagination: AdminVillaCardHousePagination;
}> {
  const url = request ? new URL(request.url) : null;
  const houseId = url?.searchParams.get("houseId")?.trim();

  if (houseId && /^[1-9]\d*$/.test(houseId)) {
    const listing = await getListingById(houseId);
    const houses = listing
      ? toPublicVillaListings([listing]).map(toHouseOption)
      : [];

    return {
      houses,
      pagination: {
        hasMore: false,
        page: 1,
        pageCount: Math.max(1, houses.length),
        pageSize: 1,
        search: "",
        total: houses.length,
      },
    };
  }

  const page = toPositiveInt(
    url?.searchParams.get("page") ?? null,
    DEFAULT_HOUSE_PAGE,
  );
  const pageSize = toHousePageSize(url?.searchParams.get("pageSize") ?? null);
  const search = url?.searchParams.get("search")?.trim() ?? "";
  const result = await fetchVillaCardHouseOptionPage({ page, pageSize, search });

  return {
    houses: result.items,
    pagination: {
      hasMore: result.hasMore,
      page: result.page,
      pageCount: Math.max(1, Math.ceil(result.total / result.pageSize)),
      pageSize: result.pageSize,
      search,
      total: result.total,
    },
  };
}

export async function buildAdminVillaCardImageConfigsResponse(
  supabase: HomeConfigSupabaseClient,
  request?: Request,
) {
  const housePage = await mapVillaCardHouseOptions(request);
  const houseIds = housePage.houses.map((house) => house.id);
  const configsResponse =
    houseIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("villa_card_image_configs")
          .select(VILLA_CARD_IMAGE_CONFIG_SELECT)
          .eq("page_key", VILLA_CARD_IMAGE_CONFIG_PAGE_KEY)
          .in("house_id", houseIds)
          .order("house_id", { ascending: true })
          .order("sort_order", {
            ascending: true,
            referencedTable: "villa_card_image_items",
          });
  const { data, error } = configsResponse;

  if (error || !Array.isArray(data)) {
    return adminSupabaseErrorResponse(
      error,
      "Unable to load villa card image configs.",
    );
  }

  try {
    return Response.json({
      configs: (data as VillaCardImageConfigRow[]).map(mapVillaCardImageConfigRow),
      houses: housePage.houses,
      pagination: housePage.pagination,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Invalid villa card image config data.",
        details:
          error instanceof Error
            ? error.message
            : "Unable to map villa card image config row.",
      },
      { status: 500 },
    );
  }
}

async function readJsonRequest(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function saveAdminVillaCardImageConfigPayload(
  payload: unknown,
  supabase: HomeConfigSupabaseClient,
) {
  const parsedPayload = parseVillaCardImageConfigPayload(payload);

  if (parsedPayload.errors.length > 0 || !parsedPayload.config) {
    return Response.json({ errors: parsedPayload.errors }, { status: 400 });
  }

  const config = parsedPayload.config;
  const { data, error } = await supabase
    .from("villa_card_image_configs")
    .upsert(
      {
        house_id: config.houseId,
        is_active: config.isActive,
        page_key: config.pageKey,
      },
      { onConflict: "page_key,house_id" },
    )
    .select("id,page_key,house_id,is_active")
    .single();

  if (error || !data) {
    return adminSupabaseErrorResponse(
      error,
      "Unable to save villa card image config.",
    );
  }

  const savedConfig = mapVillaCardImageConfigRow({
    ...(data as VillaCardImageConfigRow),
    villa_card_image_items: [],
  });
  const deleteResult = await supabase
    .from("villa_card_image_items")
    .delete()
    .eq("config_id", savedConfig.id) as { error: SupabaseLikeError | null };

  if (deleteResult.error) {
    return adminSupabaseErrorResponse(
      deleteResult.error,
      "Unable to replace villa card image items.",
    );
  }

  if (config.imageIds.length > 0) {
    const itemRows = config.imageIds.map((imageId, index) => ({
      config_id: savedConfig.id,
      image_id: imageId,
      sort_order: index + 1,
    }));
    const insertResult = await supabase
      .from("villa_card_image_items")
      .insert(itemRows) as { error: SupabaseLikeError | null };

    if (insertResult.error) {
      return adminSupabaseErrorResponse(
        insertResult.error,
        "Unable to save villa card image items.",
      );
    }
  }

  await revalidateVillaCardImagesCache(config.houseId);

  return Response.json({
    config: {
      ...savedConfig,
      imageIds: config.imageIds,
    },
  });
}

export async function saveAdminVillaCardImageConfig(
  request: Request,
  supabase: HomeConfigSupabaseClient,
) {
  return saveAdminVillaCardImageConfigPayload(await readJsonRequest(request), supabase);
}

export async function saveAdminVillaCardImages(
  request: Request,
  supabase: HomeConfigSupabaseClient,
) {
  return saveAdminVillaCardImageConfigPayload(await readJsonRequest(request), supabase);
}
