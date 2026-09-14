import "server-only";

import { revalidateVillaReviewsCache } from "@/lib/cache-revalidation";
import { fetchVillaTitlesByIds } from "@/lib/villas/server";
import { normalizeThaiPhone, validateReviewFiles } from "./input-validation";
import { createVillaReviewsClient } from "./supabase";
import { validateAdminReviewUpdate } from "./validation";
import type {
  AdminReviewUpdateValue, AdminVillaReviewDetail, AdminVillaReviewListItem,
  AdminVillaReviewListQuery, AdminVillaReviewListResult,
} from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIST_COLUMNS = "id,villa_id,rating,comment,masked_phone,created_at,updated_at";
const BUCKET = "villa-reviews";
const PAGE_SIZE = 6;
type Client = ReturnType<typeof createVillaReviewsClient>;
type ErrorCode = "validation_error" | "not_found" | "storage_error" | "database_error" | "mutation_outcome_unknown";

/** Safe route metadata: never forward database details containing private rows. */
export class AdminVillaReviewError extends Error {
  readonly details = null;
  readonly hint = null;

  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status = 500,
    public readonly fieldErrors: Record<string, string> = {},
    public readonly supabaseCode: string | null = null,
  ) {
    super(message);
    this.name = "AdminVillaReviewError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function parseAdminReviewUpdate(payload: unknown):
  { ok: true; value: AdminReviewUpdateValue } | { ok: false; errors: Record<string, string> } {
  const record = asRecord(payload);
  const validation = validateAdminReviewUpdate({
    rating: record?.rating, comment: record?.comment, retainedImageIds: record?.retainedImageIds,
  });
  return validation.ok && validation.value
    ? { ok: true, value: validation.value }
    : { ok: false, errors: validation.fieldErrors };
}

function databaseError(error: unknown): AdminVillaReviewError {
  const rawCode = asRecord(error)?.code;
  const code = typeof rawCode === "string" && /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(rawCode) ? rawCode : null;
  if (code === "P0002") return new AdminVillaReviewError("not_found", "ไม่พบรีวิวนี้", 404, {}, code);
  if (code === "22023" || code === "23514" || code === "22P02") {
    const message = asRecord(error)?.message;
    const field = message === "Invalid review rating" ? "rating"
      : message === "Invalid review comment" ? "comment"
      : typeof message === "string" && message.toLowerCase().includes("image") ? "images" : "review";
    return new AdminVillaReviewError("validation_error", "ข้อมูลรีวิวไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง", 400,
      { [field]: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" }, code);
  }
  return new AdminVillaReviewError("database_error", "ดำเนินการข้อมูลรีวิวไม่สำเร็จ", 500, {}, code);
}

interface ReviewRow {
  id: string; villa_id: string; rating: number; comment: string; masked_phone: string;
  created_at: string; updated_at: string;
}
interface PrivateReviewRow extends ReviewRow { phone_e164: string; booking_code: string }

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function normalizeVillaCodeSearch(value: string): string | null {
  const match = /^(?:dv\s*-?\s*)?([1-9]\d{0,14})$/i.exec(value.trim());
  return match?.[1] ?? null;
}

export function parseAdminReviewListQuery(query: AdminVillaReviewListQuery) {
  const pageSize = query.pageSize ?? PAGE_SIZE;
  const page = query.page ?? 1;
  const rating = query.rating ?? null;
  const sort = query.sort ?? "newest";
  if ((query.search !== undefined && typeof query.search !== "string")
    || (query.search?.length ?? 0) > 100 || /[\u0000-\u001f\u007f]/.test(query.search ?? "")
    || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > PAGE_SIZE
    || !Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(page * pageSize)
    || (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5))
    || !["newest", "oldest", "highest", "lowest"].includes(sort)
    || (query.hasImages !== undefined && typeof query.hasImages !== "boolean")
    || (query.villaId !== undefined && (typeof query.villaId !== "string" || !/^[1-9]\d{0,14}$/.test(query.villaId)))
    || (query.dateFrom !== undefined && !validDate(query.dateFrom))
    || (query.dateTo !== undefined && !validDate(query.dateTo))
    || (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo)) {
    throw new AdminVillaReviewError("validation_error", "ตัวกรองรีวิวไม่ถูกต้อง", 400);
  }
  const search = (query.search ?? "").trim();
  return { pageSize, page, rating, search, sort };
}

async function resolveTitles(ids: string[]): Promise<Map<string, string>> {
  try { return await fetchVillaTitlesByIds([...new Set(ids)]); }
  catch { return new Map(); }
}

function mapListItem(row: ReviewRow, titles: Map<string, string>, images: { id: string; public_url?: string; display_order?: number }[]): AdminVillaReviewListItem {
  const firstImage = [...images].sort((left, right) => (left.display_order ?? Number.MAX_SAFE_INTEGER) - (right.display_order ?? Number.MAX_SAFE_INTEGER))[0];
  return {
    id: row.id, villaId: row.villa_id, villaTitle: titles.get(row.villa_id) ?? `พูลวิลล่า ${row.villa_id}`,
    rating: row.rating, commentExcerpt: row.comment.slice(0, 160), maskedPhone: row.masked_phone,
    imageCount: images.length, ...(typeof firstImage?.public_url === "string" ? { reviewImageUrl: firstImage.public_url } : {}), createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function listAdminVillaReviews(query: AdminVillaReviewListQuery = {}): Promise<AdminVillaReviewListResult> {
  const { pageSize, page, rating, search, sort } = parseAdminReviewListQuery(query);
  const client = createVillaReviewsClient();
  let select = client.from("villa_reviews").select(`${LIST_COLUMNS},villa_review_images(id,public_url,display_order)`, { count: "exact" });
  if (sort === "highest" || sort === "lowest") select = select.order("rating", { ascending: sort === "lowest" });
  select = select.order("created_at", { ascending: sort === "oldest" }).order("id", { ascending: sort === "oldest" })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (rating !== null) select = select.eq("rating", rating);
  if (query.villaId) select = select.eq("villa_id", query.villaId);
  if (query.dateFrom) select = select.gte("created_at", `${query.dateFrom}T00:00:00+07:00`);
  if (query.dateTo) select = select.lt("created_at", new Date(Date.parse(`${query.dateTo}T00:00:00+07:00`) + 86400000).toISOString());
  if (query.hasImages === true) select = select.not("villa_review_images", "is", null);
  if (query.hasImages === false) select = select.is("villa_review_images", null);
  if (search) {
    // Quote filter values against PostgREST operators and escape LIKE tokens.
    // PostgREST translates * to %, so a literal * uses equality instead.
    const exact = search.includes("*");
    const operator = exact ? "eq" : "ilike";
    const escaped = search.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
    const pattern = JSON.stringify(exact ? search : `%${escaped}%`);
    const phonePattern = normalizeThaiPhone(search);
    const filters = [`booking_code.${operator}.${pattern}`, `phone_e164.${operator}.${phonePattern ? JSON.stringify(`%${phonePattern}%`) : pattern}`, `villa_id.${operator}.${pattern}`, `comment.${operator}.${pattern}`, `masked_phone.${operator}.${pattern}`];
    const villaCode = normalizeVillaCodeSearch(search);
    if (villaCode) filters.push(`villa_id.eq.${JSON.stringify(villaCode)}`);
    if (UUID.test(search)) filters.push(`id.eq.${search}`);
    select = select.or(filters.join(","));
  }
  const result = await select;
  // A saved list URL can outlive the last row on that page. PostgREST returns
  // 416 without a usable count; re-read one row with the same filters for metadata.
  if (result.error?.code === "PGRST103" && page > 1) {
    const first = await select.range(0, 0);
    if (first.error || !Number.isSafeInteger(first.count) || first.count! < 0) throw databaseError(first.error);
    return { items: [], total: first.count!, page, pageSize };
  }
  if (result.error || !Array.isArray(result.data)) throw databaseError(result.error);
  if (!Number.isSafeInteger(result.count) || result.count! < 0) throw databaseError(null);
  const rows = (result.data as unknown as (ReviewRow & { villa_review_images: { id: string; public_url?: string; display_order?: number }[] })[]).slice(0, pageSize);
  const titles = rows.length ? await resolveTitles(rows.map((row) => row.villa_id)) : new Map<string, string>();
  return {
    items: rows.map((row) => mapListItem(row, titles, row.villa_review_images ?? [])),
    total: result.count!, page, pageSize,
  };
}

export async function getAdminVillaReviewDetail(id: string): Promise<AdminVillaReviewDetail | null> {
  if (!UUID.test(id)) return null;
  const client = createVillaReviewsClient();
  const review = await client.from("villa_reviews").select(`${LIST_COLUMNS},phone_e164,booking_code`).eq("id", id).maybeSingle();
  if (review.error) throw databaseError(review.error);
  if (!review.data) return null;
  const row = review.data as PrivateReviewRow;
  const [titles, images, logs] = await Promise.all([
    resolveTitles([row.villa_id]),
    client.from("villa_review_images").select("id,public_url,display_order").eq("review_id", id)
      .order("display_order", { ascending: true }).order("id", { ascending: true }).limit(5),
    client.from("villa_review_edit_logs").select("id,review_id,before_snapshot,after_snapshot,created_at").eq("review_id", id)
      .order("created_at", { ascending: true }).order("id", { ascending: true }),
  ]);
  if (images.error || !Array.isArray(images.data)) throw databaseError(images.error);
  if (logs.error || !Array.isArray(logs.data)) throw databaseError(logs.error);
  return {
    ...mapListItem(row, titles, images.data), comment: row.comment, phoneE164: row.phone_e164, bookingCode: row.booking_code,
    images: images.data.map((image) => ({ id: image.id, url: image.public_url, displayOrder: image.display_order })),
    editLogs: logs.data.map((log) => ({ id: log.id, reviewId: log.review_id, beforeSnapshot: asRecord(log.before_snapshot) ?? {},
      afterSnapshot: asRecord(log.after_snapshot) ?? {}, createdAt: log.created_at })),
  };
}

function validateMutationIds(id: string, editorId: string) {
  if (!UUID.test(id)) throw new AdminVillaReviewError("not_found", "ไม่พบรีวิวนี้", 404);
  if (!UUID.test(editorId)) throw new AdminVillaReviewError("validation_error", "ข้อมูลผู้แก้ไขไม่ถูกต้อง", 400);
}

async function cleanupAssets(client: Client, paths: string[]) {
  if (!paths.length) return;
  try {
    const result = await client.storage.from(BUCKET).remove(paths);
    if (result.error) console.error("Admin villa review storage cleanup failed", { count: paths.length });
  } catch { console.error("Admin villa review storage cleanup failed", { count: paths.length }); }
}

function unknownOutcome() {
  return new AdminVillaReviewError("mutation_outcome_unknown", "ยังยืนยันผลการบันทึกไม่ได้ กรุณาโหลดรีวิวใหม่ก่อนลองอีกครั้ง", 503);
}

async function commitMutation(client: Client, rpc: "update_villa_review_admin" | "delete_villa_review_admin", args: Record<string, unknown>, uploadedPaths: string[] = []) {
  let result;
  try { result = await client.rpc(rpc, args); }
  catch { throw unknownOutcome(); }
  if (result.error) {
    // Transport errors cannot prove rollback; preserve uploads that may already
    // belong to a committed transaction, matching the public submission policy.
    const code = result.error.code;
    const rejected = result.status >= 400 && result.status <= 599 && /^[0-9A-Z]{5}$/.test(code)
      && !code.startsWith("08") && code !== "40003";
    if (!rejected) throw unknownOutcome();
    await cleanupAssets(client, uploadedPaths);
    throw databaseError(result.error);
  }
  const value = asRecord(result.data);
  if (result.status < 200 || result.status >= 300 || !value || value.review_id !== args.p_review_id
    || typeof value.villa_id !== "string" || !value.villa_id || !Array.isArray(value.removed_storage_paths)
    || value.removed_storage_paths.some((path) => typeof path !== "string" || !/^villa-reviews\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp)$/.test(path))) {
    throw unknownOutcome();
  }
  await cleanupAssets(client, value.removed_storage_paths as string[]);
  try { await revalidateVillaReviewsCache(value.villa_id); }
  catch { console.error("Admin villa review cache revalidation failed", { reviewId: args.p_review_id }); }
  return { ok: true as const, reviewId: value.review_id as string, villaId: value.villa_id };
}

export async function updateAdminVillaReview({ id, editorId, input, files }: {
  id: string; editorId: string; input: unknown; files: File[];
}) {
  validateMutationIds(id, editorId);
  const parsed = parseAdminReviewUpdate(input);
  if (!parsed.ok) throw new AdminVillaReviewError("validation_error", "กรุณาตรวจสอบข้อมูลรีวิว", 400, parsed.errors);
  const validation = validateReviewFiles(files, { existingImageCount: parsed.value.retainedImageIds.length });
  if (!validation.ok) throw new AdminVillaReviewError("validation_error", "กรุณาตรวจสอบรูปรีวิว", 400, validation.errors);
  const client = createVillaReviewsClient();
  const storage = client.storage.from(BUCKET);
  const uploadedPaths: string[] = [];
  const images: { storage_path: string; public_url: string }[] = [];
  const requestId = crypto.randomUUID();
  try {
    for (const file of files) {
      const extension = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();
      const path = `villa-reviews/${requestId}/${crypto.randomUUID()}.${extension}`;
      const upload = await storage.upload(path, file, { contentType: file.type, upsert: false });
      if (upload.error) throw new Error();
      uploadedPaths.push(path);
      images.push({ storage_path: path, public_url: storage.getPublicUrl(path).data.publicUrl });
    }
  } catch {
    await cleanupAssets(client, uploadedPaths);
    throw new AdminVillaReviewError("storage_error", "อัปโหลดรูปรีวิวไม่สำเร็จ", 500);
  }
  return commitMutation(client, "update_villa_review_admin", {
    p_review_id: id.toLowerCase(), p_editor_id: editorId.toLowerCase(), p_rating: parsed.value.rating, p_comment: parsed.value.comment,
    p_retained_image_ids: parsed.value.retainedImageIds, p_new_images: images,
  }, uploadedPaths);
}

export async function deleteAdminVillaReview({ id, editorId }: { id: string; editorId: string }) {
  validateMutationIds(id, editorId);
  return commitMutation(createVillaReviewsClient(), "delete_villa_review_admin", { p_review_id: id.toLowerCase(), p_editor_id: editorId.toLowerCase() });
}
