import "server-only";

import type {
  HomeConfigSupabaseClient,
  SupabaseLikeError,
} from "@/lib/admin/route-helpers";
import { adminSupabaseErrorResponse } from "@/lib/admin/route-helpers";
import { revalidateCustomerReviewsCache } from "@/lib/cache-revalidation";
import { SITE_ASSETS_BUCKET } from "@/lib/site-settings/defaults";
import {
  type AdminCustomerReviewImage,
  CUSTOMER_REVIEW_HOMEPAGE_LAYOUTS,
  type CustomerReviewHomepageLayout,
  DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT,
  normalizeCustomerReviewHomepageLayout,
  toPublicCustomerReviewHomepageLayout,
} from "./types";

const CUSTOMER_REVIEW_IMAGE_SELECT =
  "id,storage_path,public_url,alt,is_active,is_homepage,homepage_order,created_at,updated_at";
const CUSTOMER_REVIEW_ASSET_TYPE = "customer-review";
const CUSTOMER_REVIEW_PATH_PREFIX = "customer-reviews";
const CUSTOMER_REVIEW_UPLOAD_LIMIT_BYTES = 6 * 1024 * 1024;
const CUSTOMER_REVIEW_ALT_LIMIT = 160;
const CUSTOMER_REVIEW_IMAGE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CUSTOMER_REVIEW_UPLOAD_EXTENSIONS = new Set(["jpeg", "jpg", "png", "webp"]);
const CUSTOMER_REVIEW_UPLOAD_MIME_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const CUSTOMER_REVIEW_STORAGE_MIME_TYPE = "image/webp";

interface CustomerReviewImageRow {
  alt?: unknown;
  created_at?: unknown;
  homepage_order?: unknown;
  id?: unknown;
  is_active?: unknown;
  is_homepage?: unknown;
  public_url?: unknown;
  storage_path?: unknown;
  updated_at?: unknown;
}

interface CustomerReviewHomepageSettingsRow {
  layout?: unknown;
}

type UploadedCustomerReviewAsset =
  | {
      asset: {
        path: string;
        publicUrl: string;
        uploadId: string;
      };
      response: null;
    }
  | {
      asset: null;
      response: Response;
    };

type ParsedCustomerReviewHomepageQueuePayload =
  | {
      errors: [];
      queue: {
        imageIds: string[];
        layout: CustomerReviewHomepageLayout;
      };
    }
  | {
      errors: string[];
      queue: null;
    };

type ParsedCustomerReviewImageUpdatePayload =
  | {
      errors: [];
      update: {
        alt?: string;
        id: string;
      };
    }
  | {
      errors: string[];
      update: null;
    };

type DeletedCustomerReviewImage = {
  id: string;
  warning: string | null;
};

type CloudflareImagesBinding = {
  input: (image: ReadableStream<Uint8Array>) => {
    output: (options: {
      format: "image/webp";
      quality: number;
    }) => Promise<{
      response: () => Response;
    }>;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readFormString(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);

  return typeof value === "string" ? value.trim() : "";
}

function getCustomerReviewUpload(formData: FormData): File | null {
  const value = formData.get("image");

  return value instanceof File && value.size > 0 ? value : null;
}

function validateCustomerReviewUpload(file: File): string[] {
  const errors: string[] = [];
  const extension = file.name.trim().split(".").pop()?.toLowerCase() ?? "";

  if (!CUSTOMER_REVIEW_UPLOAD_MIME_EXTENSIONS.has(file.type)) {
    errors.push("Image must be JPG, PNG, or WebP.");
  }

  if (!CUSTOMER_REVIEW_UPLOAD_EXTENSIONS.has(extension)) {
    errors.push("Image extension must be .jpg, .jpeg, .png, or .webp.");
  }

  if (file.size > CUSTOMER_REVIEW_UPLOAD_LIMIT_BYTES) {
    errors.push("Image must be no larger than 6MB.");
  }

  return errors;
}

function getCustomerReviewWebpFileName(file: File): string {
  const baseName = file.name.replace(/\.[^.]+$/, "").trim() || "customer-review";

  return `${baseName}.webp`;
}

function buildCustomerReviewStoragePath(): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return `${CUSTOMER_REVIEW_PATH_PREFIX}/${year}/${month}/${crypto.randomUUID()}.webp`;
}

async function getCloudflareImagesBinding(): Promise<CloudflareImagesBinding | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const cloudflareContext = await getCloudflareContext({ async: true });
    const images = cloudflareContext.env.IMAGES;

    return images && typeof images.input === "function"
      ? (images as CloudflareImagesBinding)
      : null;
  } catch {
    return null;
  }
}

async function convertCustomerReviewUploadWithCloudflareImages(
  file: File,
): Promise<File | null> {
  const images = await getCloudflareImagesBinding();

  if (!images) {
    return null;
  }

  const result = await images
    .input(file.stream() as ReadableStream<Uint8Array>)
    .output({ format: CUSTOMER_REVIEW_STORAGE_MIME_TYPE, quality: 90 });
  const response = result.response();
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();

  if (!response.ok || contentType !== CUSTOMER_REVIEW_STORAGE_MIME_TYPE) {
    throw new Error("Cloudflare Images did not return WebP.");
  }

  return new File(
    [new Uint8Array(await response.arrayBuffer())],
    getCustomerReviewWebpFileName(file),
    { type: CUSTOMER_REVIEW_STORAGE_MIME_TYPE },
  );
}

async function convertCustomerReviewUploadToWebp(file: File): Promise<File> {
  if (file.type === CUSTOMER_REVIEW_STORAGE_MIME_TYPE) {
    return file;
  }

  let cloudflareImage: File | null = null;

  try {
    cloudflareImage = await convertCustomerReviewUploadWithCloudflareImages(file);
  } catch {
    // Fall back to Sharp when the optional Cloudflare binding is unavailable.
  }

  if (cloudflareImage) {
    return cloudflareImage;
  }

  const { default: sharp } = await import("sharp");
  const webpBuffer = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .webp({ quality: 90 })
    .toBuffer();

  return new File([new Uint8Array(webpBuffer)], getCustomerReviewWebpFileName(file), {
    type: CUSTOMER_REVIEW_STORAGE_MIME_TYPE,
  });
}

function normalizeAdminAlt(value: string): string {
  return value || "Customer review";
}

function parseCustomerReviewImageId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const imageId = value.trim();

  return CUSTOMER_REVIEW_IMAGE_ID_PATTERN.test(imageId) ? imageId : null;
}

function parseCustomerReviewDeleteIds(request: Request): {
  errors: string[];
  imageIds: string[];
  isBulk: boolean;
} {
  const searchParams = new URL(request.url).searchParams;
  const bulkValues = searchParams
    .getAll("ids")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const singleId = searchParams.get("id");
  const rawIds = bulkValues.length > 0 ? bulkValues : singleId ? [singleId] : [];
  const imageIds = rawIds
    .map((value) => parseCustomerReviewImageId(value))
    .filter((value): value is string => value !== null);
  const errors: string[] = [];

  if (rawIds.length === 0) {
    errors.push("id must be a valid UUID string.");
  }

  if (imageIds.length !== rawIds.length) {
    errors.push("ids must contain valid UUID strings.");
  }

  if (new Set(imageIds).size !== imageIds.length) {
    errors.push("ids must not contain duplicate ids.");
  }

  return {
    errors,
    imageIds,
    isBulk: bulkValues.length > 0,
  };
}

function mapAdminCustomerReviewImageRow(
  row: CustomerReviewImageRow,
): AdminCustomerReviewImage {
  if (
    typeof row.created_at !== "string" ||
    typeof row.id !== "string" ||
    typeof row.is_active !== "boolean" ||
    typeof row.is_homepage !== "boolean" ||
    typeof row.public_url !== "string" ||
    typeof row.storage_path !== "string" ||
    typeof row.updated_at !== "string"
  ) {
    throw new Error("Invalid customer review image row");
  }

  return {
    alt:
      typeof row.alt === "string" && row.alt.trim()
        ? row.alt.trim()
        : "Customer review",
    createdAt: row.created_at,
    homepageOrder:
      typeof row.homepage_order === "number" && Number.isInteger(row.homepage_order)
        ? row.homepage_order
        : null,
    id: row.id,
    isActive: row.is_active,
    isHomepage: row.is_homepage,
    path: row.storage_path,
    updatedAt: row.updated_at,
    url: row.public_url,
  };
}

function toImageIds(value: unknown, errors: string[]): string[] {
  if (!Array.isArray(value)) {
    errors.push("imageIds must be an array.");
    return [];
  }

  const imageIds = value.map((item) => (typeof item === "string" ? item.trim() : ""));

  if (imageIds.some((imageId) => !CUSTOMER_REVIEW_IMAGE_ID_PATTERN.test(imageId))) {
    errors.push("imageIds must contain valid UUID strings.");
    return [];
  }

  if (imageIds.length > 20) {
    errors.push("Select no more than 20 homepage images.");
  }

  if (new Set(imageIds).size !== imageIds.length) {
    errors.push("imageIds must not contain duplicate ids.");
  }

  return imageIds;
}

export function parseCustomerReviewHomepageQueuePayload(
  payload: unknown,
): ParsedCustomerReviewHomepageQueuePayload {
  if (!isRecord(payload)) {
    return { errors: ["Body must be an object."], queue: null };
  }

  const errors: string[] = [];
  const layout = normalizeCustomerReviewHomepageLayout(payload.layout);

  if (!layout) {
    const layoutNames = CUSTOMER_REVIEW_HOMEPAGE_LAYOUTS.join(", ").replace(
      ", carousel",
      ", or carousel",
    );

    errors.push(`layout must be ${layoutNames}.`);
  }

  const imageIds = toImageIds(payload.imageIds, errors);

  if (errors.length > 0 || !layout) {
    return { errors, queue: null };
  }

  return { errors: [], queue: { imageIds, layout } };
}

function parseCustomerReviewImageUpdatePayload(
  payload: unknown,
): ParsedCustomerReviewImageUpdatePayload {
  if (!isRecord(payload)) {
    return { errors: ["Body must be an object."], update: null };
  }

  const errors: string[] = [];
  const id = parseCustomerReviewImageId(payload.id);
  const update: { alt?: string; id: string } = {
    id: id ?? "",
  };

  if (!id) {
    errors.push("id must be a valid UUID string.");
  }

  if ("alt" in payload) {
    if (typeof payload.alt !== "string") {
      errors.push("alt must be a string.");
    } else {
      const alt = normalizeAdminAlt(payload.alt.trim());

      if (alt.length > CUSTOMER_REVIEW_ALT_LIMIT) {
        errors.push(`alt must be ${CUSTOMER_REVIEW_ALT_LIMIT} characters or less.`);
      } else {
        update.alt = alt;
      }
    }
  }

  if ("isActive" in payload) {
    errors.push("isActive updates are not supported.");
  }

  if (!("alt" in update)) {
    errors.push("Provide alt to update.");
  }

  if (errors.length > 0 || !id) {
    return { errors, update: null };
  }

  return {
    errors: [],
    update: {
      ...update,
      id,
    },
  };
}

async function readJsonRequest(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function removeUploadedCustomerReviewImage(
  supabase: HomeConfigSupabaseClient,
  path: string,
) {
  await supabase.storage.from(SITE_ASSETS_BUCKET).remove([path]);
}

async function deleteCustomerReviewUploadHistory(
  supabase: HomeConfigSupabaseClient,
  uploadId: string,
) {
  await supabase.from("site_asset_uploads").delete().eq("id", uploadId);
}

async function deleteCustomerReviewUploadHistoryByPath(
  supabase: HomeConfigSupabaseClient,
  path: string,
): Promise<SupabaseLikeError | null> {
  const { error } = await supabase
    .from("site_asset_uploads")
    .delete()
    .eq("asset_type", CUSTOMER_REVIEW_ASSET_TYPE)
    .eq("storage_bucket", SITE_ASSETS_BUCKET)
    .eq("storage_path", path);

  return error ?? null;
}

async function recordCustomerReviewUpload(
  supabase: HomeConfigSupabaseClient,
  path: string,
  publicUrl: string,
): Promise<{ error: SupabaseLikeError | null; uploadId: string | null }> {
  const { data, error } = await supabase
    .from("site_asset_uploads")
    .insert({
      asset_type: CUSTOMER_REVIEW_ASSET_TYPE,
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

async function uploadCustomerReviewAsset(
  supabase: HomeConfigSupabaseClient,
  image: File,
): Promise<UploadedCustomerReviewAsset> {
  const path = buildCustomerReviewStoragePath();
  const uploadResult = await supabase.storage
    .from(SITE_ASSETS_BUCKET)
    .upload(path, image, {
      cacheControl: "31536000",
      contentType: image.type,
      upsert: false,
    });

  if (uploadResult.error) {
    return {
      asset: null,
      response: adminSupabaseErrorResponse(
        uploadResult.error,
        "Unable to upload customer review image.",
      ),
    };
  }

  const { data: publicUrlData } = supabase.storage
    .from(SITE_ASSETS_BUCKET)
    .getPublicUrl(path);
  const publicUrl = publicUrlData.publicUrl;
  const historyResult = await recordCustomerReviewUpload(supabase, path, publicUrl);

  if (historyResult.error || !historyResult.uploadId) {
    await removeUploadedCustomerReviewImage(supabase, path);

    return {
      asset: null,
      response: adminSupabaseErrorResponse(
        historyResult.error ?? {
          message: "Unable to read customer review upload id.",
        },
        "Unable to record customer review upload history.",
      ),
    };
  }

  return {
    asset: {
      path,
      publicUrl,
      uploadId: historyResult.uploadId,
    },
    response: null,
  };
}

export async function buildAdminCustomerReviewImagesResponse(
  supabase: HomeConfigSupabaseClient,
) {
  const settingsResult = await supabase
    .from("customer_review_homepage_settings")
    .select("layout")
    .eq("singleton_id", true)
    .maybeSingle();

  if (settingsResult.error) {
    return adminSupabaseErrorResponse(
      settingsResult.error,
      "Unable to load customer review homepage settings.",
    );
  }

  const imageResult = await supabase
    .from("customer_review_images")
    .select(CUSTOMER_REVIEW_IMAGE_SELECT)
    .order("created_at", { ascending: false });

  if (imageResult.error || !Array.isArray(imageResult.data)) {
    return adminSupabaseErrorResponse(
      imageResult.error,
      "Unable to load customer review images.",
    );
  }

  try {
    const images = (imageResult.data as CustomerReviewImageRow[]).map(
      mapAdminCustomerReviewImageRow,
    );
    const queueImageIds = images
      .filter((image) => image.isHomepage && image.homepageOrder !== null)
      .sort((a, b) => (a.homepageOrder ?? 0) - (b.homepageOrder ?? 0))
      .map((image) => image.id);

    return Response.json({
      images,
      layout: toPublicCustomerReviewHomepageLayout(
        (settingsResult.data as CustomerReviewHomepageSettingsRow | null)?.layout,
      ),
      queueImageIds,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Invalid customer review image data.",
        details:
          error instanceof Error
            ? error.message
            : "Unable to map customer review image row.",
      },
      { status: 500 },
    );
  }
}

export async function saveAdminCustomerReviewHomepageQueue(
  request: Request,
  supabase: HomeConfigSupabaseClient,
) {
  return saveAdminCustomerReviewHomepageQueuePayload(
    await readJsonRequest(request),
    supabase,
  );
}

async function saveAdminCustomerReviewHomepageQueuePayload(
  payload: unknown,
  supabase: HomeConfigSupabaseClient,
) {
  const parsedPayload = parseCustomerReviewHomepageQueuePayload(payload);

  if (parsedPayload.errors.length > 0 || !parsedPayload.queue) {
    return Response.json({ errors: parsedPayload.errors }, { status: 400 });
  }

  const { imageIds, layout } = parsedPayload.queue;
  const { error } = await supabase.rpc("save_customer_review_homepage_queue", {
    image_ids: imageIds,
    selected_layout: layout,
  });

  if (error) {
    return adminSupabaseErrorResponse(
      error,
      "Unable to save customer review homepage queue.",
    );
  }

  await revalidateCustomerReviewsCache();

  return Response.json({ layout, queueImageIds: imageIds });
}

export async function updateAdminCustomerReviewImage(
  payload: unknown,
  supabase: HomeConfigSupabaseClient,
) {
  const parsedPayload = parseCustomerReviewImageUpdatePayload(payload);

  if (parsedPayload.errors.length > 0 || !parsedPayload.update) {
    return Response.json({ errors: parsedPayload.errors }, { status: 400 });
  }

  const { alt, id } = parsedPayload.update;
  const updates: Record<string, string> = {};

  if (alt !== undefined) {
    updates.alt = alt;
  }

  const { data, error } = await supabase
    .from("customer_review_images")
    .update(updates)
    .eq("id", id)
    .select(CUSTOMER_REVIEW_IMAGE_SELECT)
    .single();

  if (error || !data) {
    return adminSupabaseErrorResponse(
      error,
      "Unable to update customer review image.",
    );
  }

  await revalidateCustomerReviewsCache();

  return Response.json({
    image: mapAdminCustomerReviewImageRow(data as CustomerReviewImageRow),
  });
}

export async function uploadAdminCustomerReviewImage(
  request: Request,
  supabase: HomeConfigSupabaseClient,
) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { errors: ["Request body must be multipart/form-data."] },
      { status: 400 },
    );
  }

  const image = getCustomerReviewUpload(formData);

  if (!image) {
    return Response.json({ errors: ["image is required."] }, { status: 400 });
  }

  const errors = validateCustomerReviewUpload(image);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  let webpImage: File;

  try {
    webpImage = await convertCustomerReviewUploadToWebp(image);
  } catch {
    return Response.json(
      { errors: ["Unable to convert customer review image to WebP."] },
      { status: 400 },
    );
  }

  const upload = await uploadCustomerReviewAsset(supabase, webpImage);

  if (!upload.asset) {
    return upload.response;
  }

  const { data, error } = await supabase
    .from("customer_review_images")
    .insert({
      storage_bucket: SITE_ASSETS_BUCKET,
      storage_path: upload.asset.path,
      public_url: upload.asset.publicUrl,
      alt: normalizeAdminAlt(readFormString(formData, "alt")),
      is_active: true,
      is_homepage: false,
    })
    .select(CUSTOMER_REVIEW_IMAGE_SELECT)
    .single();

  if (error || !data) {
    await deleteCustomerReviewUploadHistory(supabase, upload.asset.uploadId);
    await removeUploadedCustomerReviewImage(supabase, upload.asset.path);

    return adminSupabaseErrorResponse(
      error,
      "Unable to save customer review image metadata.",
    );
  }

  return Response.json({
    image: mapAdminCustomerReviewImageRow(data as CustomerReviewImageRow),
  });
}

export async function handleAdminCustomerReviewPatch(
  request: Request,
  supabase: HomeConfigSupabaseClient,
) {
  if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    return Response.json(
      { errors: ["Image replacement is not supported."] },
      { status: 415 },
    );
  }

  const payload = await readJsonRequest(request);

  if (isRecord(payload) && payload.action === "update-image") {
    return updateAdminCustomerReviewImage(payload, supabase);
  }

  return saveAdminCustomerReviewHomepageQueuePayload(payload, supabase);
}

export async function deleteAdminCustomerReviewImage(
  request: Request,
  supabase: HomeConfigSupabaseClient,
) {
  const parsedDelete = parseCustomerReviewDeleteIds(request);

  if (parsedDelete.errors.length > 0) {
    return Response.json(
      { errors: parsedDelete.errors },
      { status: 400 },
    );
  }

  const deletedImages: DeletedCustomerReviewImage[] = [];

  for (const id of parsedDelete.imageIds) {
    const deleteResult = await deleteCustomerReviewImageById(supabase, id);

    if (deleteResult.response) {
      return deleteResult.response;
    }

    deletedImages.push(deleteResult.deletedImage);
  }

  await revalidateCustomerReviewsCache();

  if (!parsedDelete.isBulk && deletedImages.length === 1) {
    return Response.json({
      deletedImageId: deletedImages[0].id,
      warning: deletedImages[0].warning,
    });
  }

  return Response.json({
    deletedImageIds: deletedImages.map((image) => image.id),
    warnings: deletedImages
      .filter((image) => image.warning)
      .map((image) => `${image.id}: ${image.warning}`),
  });
}

async function deleteCustomerReviewImageById(
  supabase: HomeConfigSupabaseClient,
  id: string,
): Promise<
  | { deletedImage: DeletedCustomerReviewImage; response: null }
  | { deletedImage: null; response: Response }
> {
  const currentResult = await supabase
    .from("customer_review_images")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (currentResult.error || !currentResult.data) {
    return {
      deletedImage: null,
      response: adminSupabaseErrorResponse(
        currentResult.error,
        "Unable to load customer review image.",
      ),
    };
  }

  const path = (currentResult.data as { storage_path?: unknown }).storage_path;

  if (typeof path !== "string" || !path) {
    return {
      deletedImage: null,
      response: Response.json(
        { error: "Invalid customer review image storage path." },
        { status: 500 },
      ),
    };
  }

  const deleteResult = await supabase
    .from("customer_review_images")
    .delete()
    .eq("id", id);

  if (deleteResult.error) {
    return {
      deletedImage: null,
      response: adminSupabaseErrorResponse(
        deleteResult.error,
        "Unable to delete customer review image.",
      ),
    };
  }

  const historyError = await deleteCustomerReviewUploadHistoryByPath(
    supabase,
    path,
  );
  const storageResult = await supabase.storage
    .from(SITE_ASSETS_BUCKET)
    .remove([path]);
  const warning =
    historyError?.message ?? storageResult.error?.message ?? null;

  return {
    deletedImage: { id, warning },
    response: null,
  };
}

export { DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT };
