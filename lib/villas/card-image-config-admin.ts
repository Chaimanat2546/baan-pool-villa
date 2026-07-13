import type {
  HomeConfigSupabaseClient,
  SupabaseLikeError,
} from "@/lib/admin/route-helpers";
import { adminSupabaseErrorResponse } from "@/lib/admin/route-helpers";
import {
  revalidateSiteSettingsCache,
  revalidateVillaCardImagesCache,
} from "@/lib/cache-revalidation";
import { SITE_ASSETS_BUCKET, SITE_SETTINGS_ID } from "@/lib/site-settings/defaults";
import type { SiteVillaCardStyle } from "@/lib/site-settings/types";
import { validateCustomDisplayImageIds } from "@/lib/villas/images";
import { toPublicVillaListings } from "@/lib/villas/public-dto";
import {
  fetchVillaCardHouseOptionPage,
  getListingById,
} from "@/lib/villas/server";

export const VILLA_CARD_IMAGE_CONFIG_SELECT =
  "id,page_key,house_id,is_active,cover_image_path,cover_image_url,cover_image_alt,villa_card_image_items(image_id,sort_order)";

interface VillaCardImageConfigRow {
  cover_image_alt?: unknown;
  cover_image_path?: unknown;
  cover_image_url?: unknown;
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
  coverImage: AdminVillaCardCoverImage | null;
  houseId: string;
  id: string;
  imageIds: number[];
  isActive: boolean;
  pageKey: string;
}

export interface AdminVillaCardCoverImage {
  alt: string;
  path: string;
  url: string;
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
const VILLA_CARD_COVER_ASSET_TYPE = "villa-cover";
const VILLA_CARD_COVER_PATH_PREFIX = "villa-cover";
const DEFAULT_HOUSE_PAGE = 1;
const DEFAULT_HOUSE_PAGE_SIZE = 10;
const MAX_HOUSE_PAGE_SIZE = 50;
const COVER_UPLOAD_LIMIT_BYTES = 6 * 1024 * 1024;
const COVER_UPLOAD_EXTENSIONS = new Set(["jpeg", "jpg", "png", "webp"]);
const COVER_UPLOAD_MIME_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function toVillaCardStyle(value: unknown): SiteVillaCardStyle {
  return value === "gallery" ? "gallery" : "classic";
}

async function loadVillaCardStyle(supabase: HomeConfigSupabaseClient) {
  return supabase
    .from("site_settings")
    .select("villa_card_style")
    .eq("id", SITE_SETTINGS_ID)
    .maybeSingle();
}

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

function mapCoverImage(row: VillaCardImageConfigRow): AdminVillaCardCoverImage | null {
  const path = typeof row.cover_image_path === "string" ? row.cover_image_path.trim() : "";
  const url = typeof row.cover_image_url === "string" ? row.cover_image_url.trim() : "";

  if (!path || !url) {
    return null;
  }

  return {
    alt:
      typeof row.cover_image_alt === "string" && row.cover_image_alt.trim()
        ? row.cover_image_alt.trim()
        : "Villa cover",
    path,
    url,
  };
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
    coverImage: mapCoverImage(row),
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
      coverImage: null,
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

  const styleResult = await loadVillaCardStyle(supabase);
  if (styleResult.error) {
    return adminSupabaseErrorResponse(
      styleResult.error,
      "Unable to load villa card style.",
    );
  }

  try {
    return Response.json({
      configs: (data as VillaCardImageConfigRow[]).map(mapVillaCardImageConfigRow),
      houses: housePage.houses,
      pagination: housePage.pagination,
      villaCardStyle: toVillaCardStyle(styleResult.data?.villa_card_style),
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

function readFormString(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);

  return typeof value === "string" ? value.trim() : "";
}

function getCoverUpload(formData: FormData): File | null {
  const value = formData.get("coverImage");

  return value instanceof File && value.size > 0 ? value : null;
}

function getUploadExtension(mimeType: string): string | null {
  return COVER_UPLOAD_MIME_EXTENSIONS.get(mimeType) ?? null;
}

function validateCoverUpload(file: File): string[] {
  const errors: string[] = [];
  const extension = file.name.trim().split(".").pop()?.toLowerCase() ?? "";

  if (!COVER_UPLOAD_MIME_EXTENSIONS.has(file.type)) {
    errors.push("Cover image must be JPG, PNG, or WebP.");
  }

  if (!COVER_UPLOAD_EXTENSIONS.has(extension)) {
    errors.push("Cover image extension must be .jpg, .jpeg, .png, or .webp.");
  }

  if (file.size > COVER_UPLOAD_LIMIT_BYTES) {
    errors.push("Cover image must be no larger than 6MB.");
  }

  return errors;
}

function buildVillaCoverStoragePath(houseId: string, mimeType: string): string {
  const extension = getUploadExtension(mimeType);

  if (!extension) {
    throw new Error("Unsupported cover image MIME type.");
  }

  return `${VILLA_CARD_COVER_PATH_PREFIX}/${houseId}/${crypto.randomUUID()}.${extension}`;
}

async function removeUploadedCover(
  supabase: HomeConfigSupabaseClient,
  path: string,
) {
  await supabase.storage.from(SITE_ASSETS_BUCKET).remove([path]);
}

async function deleteCoverUploadHistory(
  supabase: HomeConfigSupabaseClient,
  uploadId: string,
) {
  await supabase.from("site_asset_uploads").delete().eq("id", uploadId);
}

async function recordCoverUpload(
  supabase: HomeConfigSupabaseClient,
  path: string,
  publicUrl: string,
): Promise<{ error: SupabaseLikeError | null; uploadId: string | null }> {
  const { data, error } = await supabase
    .from("site_asset_uploads")
    .insert({
      asset_type: VILLA_CARD_COVER_ASSET_TYPE,
      storage_bucket: SITE_ASSETS_BUCKET,
      storage_path: path,
      public_url: publicUrl,
      is_current: true,
    })
    .select("id")
    .single();

  if (error) {
    return { error, uploadId: null };
  }

  return {
    error: null,
    uploadId: data && typeof data.id === "string" ? data.id : null,
  };
}

async function markPreviousVillaCoverUploadsInactive(
  supabase: HomeConfigSupabaseClient,
  houseId: string,
  uploadId: string,
) {
  await supabase
    .from("site_asset_uploads")
    .update({ is_current: false })
    .eq("asset_type", VILLA_CARD_COVER_ASSET_TYPE)
    .eq("storage_bucket", SITE_ASSETS_BUCKET)
    .eq("is_current", true)
    .like("storage_path", `${VILLA_CARD_COVER_PATH_PREFIX}/${houseId}/%`)
    .neq("id", uploadId);
}

async function markVillaCoverUploadsInactive(
  supabase: HomeConfigSupabaseClient,
  houseId: string,
) {
  await supabase
    .from("site_asset_uploads")
    .update({ is_current: false })
    .eq("asset_type", VILLA_CARD_COVER_ASSET_TYPE)
    .eq("storage_bucket", SITE_ASSETS_BUCKET)
    .eq("is_current", true)
    .like("storage_path", `${VILLA_CARD_COVER_PATH_PREFIX}/${houseId}/%`);
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
    .select("id,page_key,house_id,is_active,cover_image_path,cover_image_url,cover_image_alt")
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

async function saveAdminVillaCardStyle(
  value: unknown,
  supabase: HomeConfigSupabaseClient,
) {
  if (value !== "classic" && value !== "gallery") {
    return Response.json(
      { errors: ["villaCardStyle must be classic or gallery."] },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("site_settings")
    .update({ villa_card_style: value })
    .eq("id", SITE_SETTINGS_ID)
    .select("villa_card_style")
    .maybeSingle();
  if (error || !data) {
    return adminSupabaseErrorResponse(error, "Unable to save villa card style.");
  }

  await revalidateSiteSettingsCache();
  return Response.json({ villaCardStyle: toVillaCardStyle(data.villa_card_style) });
}

async function saveAdminVillaCardCoverPayload(
  formData: FormData,
  supabase: HomeConfigSupabaseClient,
) {
  const houseId = readFormString(formData, "houseId");
  const coverImage = getCoverUpload(formData);
  const coverImageAlt = readFormString(formData, "coverImageAlt") || `Villa ${houseId} cover`;

  if (!/^[1-9]\d*$/.test(houseId)) {
    return Response.json(
      { errors: ["houseId must be a positive house id."] },
      { status: 400 },
    );
  }

  if (!coverImage) {
    return Response.json({ errors: ["coverImage is required."] }, { status: 400 });
  }

  const errors = validateCoverUpload(coverImage);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const path = buildVillaCoverStoragePath(houseId, coverImage.type);
  const uploadResult = await supabase.storage
    .from(SITE_ASSETS_BUCKET)
    .upload(path, coverImage, {
      cacheControl: "31536000",
      contentType: coverImage.type,
      upsert: false,
    });

  if (uploadResult.error) {
    return adminSupabaseErrorResponse(
      uploadResult.error,
      "Unable to upload villa cover image.",
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from(SITE_ASSETS_BUCKET)
    .getPublicUrl(path);
  const publicUrl = publicUrlData.publicUrl;
  const historyResult = await recordCoverUpload(supabase, path, publicUrl);

  if (historyResult.error || !historyResult.uploadId) {
    await removeUploadedCover(supabase, path);

    return adminSupabaseErrorResponse(
      historyResult.error ?? { message: "Unable to read villa cover upload id." },
      "Unable to record villa cover upload history.",
    );
  }

  const { data, error } = await supabase
    .from("villa_card_image_configs")
    .upsert(
      {
        cover_image_alt: coverImageAlt,
        cover_image_path: path,
        cover_image_url: publicUrl,
        house_id: houseId,
        is_active: true,
        page_key: VILLA_CARD_IMAGE_CONFIG_PAGE_KEY,
      },
      { onConflict: "page_key,house_id" },
    )
    .select("id,page_key,house_id,is_active,cover_image_path,cover_image_url,cover_image_alt")
    .single();

  if (error || !data) {
    await deleteCoverUploadHistory(supabase, historyResult.uploadId);
    await removeUploadedCover(supabase, path);

    return adminSupabaseErrorResponse(
      error,
      "Unable to save villa cover image config.",
    );
  }

  await markPreviousVillaCoverUploadsInactive(
    supabase,
    houseId,
    historyResult.uploadId,
  );
  await revalidateVillaCardImagesCache(houseId);

  return Response.json({
    config: mapVillaCardImageConfigRow({
      ...(data as VillaCardImageConfigRow),
      villa_card_image_items: [],
    }),
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
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    try {
      return saveAdminVillaCardCoverPayload(await request.formData(), supabase);
    } catch {
      return Response.json(
        { errors: ["Request body must be multipart/form-data."] },
        { status: 400 },
      );
    }
  }

  const payload = await readJsonRequest(request);
  if (
    isRecord(payload) &&
    Object.keys(payload).length === 1 &&
    Object.hasOwn(payload, "villaCardStyle")
  ) {
    return saveAdminVillaCardStyle(payload.villaCardStyle, supabase);
  }

  return saveAdminVillaCardImageConfigPayload(payload, supabase);
}

export async function deleteAdminVillaCardCoverImage(
  request: Request,
  supabase: HomeConfigSupabaseClient,
) {
  const houseId = new URL(request.url).searchParams.get("houseId")?.trim() ?? "";

  if (!/^[1-9]\d*$/.test(houseId)) {
    return Response.json(
      { errors: ["houseId must be a positive house id."] },
      { status: 400 },
    );
  }

  const { data: currentData, error: currentError } = await supabase
    .from("villa_card_image_configs")
    .select(VILLA_CARD_IMAGE_CONFIG_SELECT)
    .eq("page_key", VILLA_CARD_IMAGE_CONFIG_PAGE_KEY)
    .eq("house_id", houseId)
    .maybeSingle();

  if (currentError) {
    return adminSupabaseErrorResponse(
      currentError,
      "Unable to load villa cover image config.",
    );
  }

  if (!currentData) {
    return Response.json({ errors: ["Villa cover image config not found."] }, { status: 404 });
  }

  const currentConfig = mapVillaCardImageConfigRow(
    currentData as VillaCardImageConfigRow,
  );
  const coverPath = currentConfig.coverImage?.path ?? null;
  const { data, error } = await supabase
    .from("villa_card_image_configs")
    .update({
      cover_image_alt: null,
      cover_image_path: null,
      cover_image_url: null,
    })
    .eq("id", currentConfig.id)
    .select(VILLA_CARD_IMAGE_CONFIG_SELECT)
    .single();

  if (error || !data) {
    return adminSupabaseErrorResponse(
      error,
      "Unable to delete villa cover image config.",
    );
  }

  await markVillaCoverUploadsInactive(supabase, houseId);

  if (coverPath) {
    await removeUploadedCover(supabase, coverPath);
  }

  await revalidateVillaCardImagesCache(houseId);

  return Response.json({
    config: mapVillaCardImageConfigRow(data as VillaCardImageConfigRow),
  });
}
