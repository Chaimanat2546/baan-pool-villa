import "server-only";

import { unstable_cache } from "next/cache";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { revalidateVillaReviewsCache } from "@/lib/cache-revalidation";
import { createBookingVerificationClient } from "./booking-verification-supabase";
import { createVillaReviewsClient } from "./supabase";
import { normalizeThaiPhone, validateReviewFiles, validateReviewSubmission } from "./validation";
import type { PublicVillaReview, ReviewPage, ReviewSort, ReviewSubmissionInput, VillaReviewSummary } from "./types";

const PUBLIC_COLUMNS = "id,villa_id,rating,comment,masked_phone,images,created_at,updated_at";
const PUBLIC_VIEW = "villa_reviews_public";
const BUCKET = "villa-reviews";
const PAGE_SIZE = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
type ReviewErrorCode = "invalid_cursor" | "validation_error" | "booking_verification_failed" | "booking_verification_unavailable" | "duplicate_booking_code" | "storage_error" | "database_error" | "submission_outcome_unknown";
export type ReviewCommitOutcome = "uncommitted" | "committed" | "unknown";

export class VillaReviewError extends Error {
  public readonly commitOutcome: ReviewCommitOutcome;

  constructor(
    public readonly code: ReviewErrorCode,
    message: string,
    committed: boolean | "unknown" = false,
    public readonly fieldErrors: Record<string, string> = {},
    public readonly detectedWords: string[] = [],
  ) {
    super(message);
    this.name = "VillaReviewError";
    this.commitOutcome = committed === "unknown" ? "unknown" : committed ? "committed" : "uncommitted";
  }

  get committed() { return this.commitOutcome === "committed"; }
  get shouldConsumeQuota() { return this.commitOutcome !== "uncommitted"; }
}

function unknownSubmissionOutcome() {
  return new VillaReviewError("submission_outcome_unknown", "ยังยืนยันผลการบันทึกรีวิวไม่ได้ กรุณาตรวจสอบรายการรีวิวก่อนส่งอีกครั้ง", "unknown");
}

function isConfirmedDatabaseRejection(status: number, code: string): boolean {
  // HTTP/gateway/response errors do not prove rollback. SQLSTATE class 08 and
  // statement_completion_unknown explicitly cannot establish a commit outcome.
  return status >= 400 && status <= 599 && /^[0-9A-Z]{5}$/.test(code)
    && !code.startsWith("08") && code !== "40003";
}

function rpcValidationFieldErrors(message: string): Record<string, string> {
  switch (message) {
    case "Invalid villa id":
      return { villaId: "ไม่พบข้อมูลบ้านพัก" };
    case "Invalid booking code":
      return { bookingCode: "กรุณากรอกรหัสการจอง" };
    case "Invalid Thai phone number":
      return { phone: "กรุณากรอกเบอร์โทรศัพท์ไทยให้ถูกต้อง" };
    case "Invalid review rating":
      return { rating: "กรุณาเลือกคะแนนรีวิว 1 ถึง 5" };
    case "Invalid review comment":
      return { comment: "ความคิดเห็นต้องไม่เกิน 1,000 ตัวอักษร" };
    case "Review images must be an array":
    case "A review can contain at most five images":
    case "Invalid review image object":
    case "Invalid review image metadata":
      return { images: "ข้อมูลรูปภาพไม่ถูกต้อง กรุณาเลือกใหม่" };
    default:
      return {};
  }
}

interface PublicRow {
  id: string; villa_id: string; rating: number; comment: string;
  masked_phone: string; created_at: string; updated_at: string;
  images: { id: string; url: string }[];
}

function isPublicReviewImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const isLocalHttp =
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname);
    return (url.protocol === "https:" || isLocalHttp) &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}

function mapPublicReview(row: PublicRow): PublicVillaReview {
  return {
    id: row.id, villaId: row.villa_id, rating: row.rating, comment: row.comment,
    maskedPhone: row.masked_phone, createdAt: row.created_at, updatedAt: row.updated_at,
    images: (Array.isArray(row.images) ? row.images : []).flatMap((image) =>
      isPublicReviewImageUrl(image.url) ? [{ id: image.id, url: image.url }] : [],
    ),
  };
}

interface ReviewCursor {
  villaId: string; sort: ReviewSort; id: string; createdAt: string; rating: number;
}

export function validateVillaReviewCursor(villaId: string, sort: ReviewSort, cursor: string | null): ReviewCursor | null {
  if (cursor === null) return null;
  try {
    if (cursor.length > 1024 || !/^[a-zA-Z0-9_-]+$/.test(cursor)) throw new Error();
    const bytes = Buffer.from(cursor, "base64url");
    if (bytes.toString("base64url") !== cursor) throw new Error();
    const value = JSON.parse(bytes.toString("utf8")) as ReviewCursor;
    if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).sort().join(",") !== "createdAt,id,rating,sort,villaId"
      || value.villaId !== villaId || value.sort !== sort
      || typeof value.id !== "string" || !UUID.test(value.id)
      || typeof value.createdAt !== "string" || !TIMESTAMP.test(value.createdAt)
      || !Number.isFinite(Date.parse(value.createdAt))
      || !Number.isInteger(value.rating) || value.rating < 1 || value.rating > 5) throw new Error();
    return value;
  } catch {
    throw new VillaReviewError("invalid_cursor", "ตัวระบุหน้าถัดไปไม่ถูกต้อง");
  }
}

export function validateVillaId(villaId: string) {
  if (!villaId || villaId !== villaId.trim() || villaId.length > 200) {
    throw new VillaReviewError("validation_error", "ข้อมูลบ้านพักไม่ถูกต้อง");
  }
}

export async function getVillaReviewSummary(villaId: string): Promise<VillaReviewSummary> {
  validateVillaId(villaId);
  return unstable_cache(async () => {
    const client = createVillaReviewsClient();
    const ratings = [1, 2, 3, 4, 5] as const;
    const counts = await Promise.all(ratings.map(async (rating) => {
      const result = await client.from(PUBLIC_VIEW).select("id", { count: "exact", head: true })
        .eq("villa_id", villaId).eq("rating", rating);
      if (result.error || result.count === null) throw new VillaReviewError("database_error", "โหลดสรุปรีวิวไม่สำเร็จ");
      return result.count;
    }));
    const totalCount = counts.reduce((sum, count) => sum + count, 0);
    const weighted = counts.reduce((sum, count, index) => sum + count * (index + 1), 0);
    return {
      totalCount, averageRating: totalCount ? weighted / totalCount : 0,
      ratingCounts: { 1: counts[0], 2: counts[1], 3: counts[2], 4: counts[3], 5: counts[4] },
    };
  }, ["villa-review-summary", villaId], {
    tags: [CACHE_TAGS.villaReviews(villaId)], revalidate: CACHE_REVALIDATE_SECONDS.villaReviews,
  })();
}

export async function getVillaReviewPage(villaId: string, sort: ReviewSort, cursor: string | null): Promise<ReviewPage> {
  validateVillaId(villaId);
  if (sort !== "newest" && sort !== "rating_desc" && sort !== "rating_asc") {
    throw new VillaReviewError("validation_error", "รูปแบบเรียงรีวิวไม่ถูกต้อง");
  }
  const after = validateVillaReviewCursor(villaId, sort, cursor);
  const loadPage = unstable_cache(async () => {
    const client = createVillaReviewsClient();
    const ascending = sort === "rating_asc";
    const orderKey = sort === "newest" ? "created_at" : "rating";
    let query = client.from(PUBLIC_VIEW).select(PUBLIC_COLUMNS).eq("villa_id", villaId)
      .order(orderKey, { ascending }).order("id", { ascending }).limit(PAGE_SIZE + 1);
    if (after) {
      const comparison = ascending ? "gt" : "lt";
      const value = sort === "newest" ? after.createdAt : after.rating;
      query = query.or(`${orderKey}.${comparison}.${value},and(${orderKey}.eq.${value},id.${comparison}.${after.id})`);
    }
    const result = await query;
    if (result.error || !Array.isArray(result.data)) throw new VillaReviewError("database_error", "โหลดรีวิวไม่สำเร็จ");
    const rows = result.data as PublicRow[];
    const items = rows.slice(0, PAGE_SIZE).map(mapPublicReview);
    const last = items.at(-1);
    const nextCursor = rows.length > PAGE_SIZE && last ? Buffer.from(JSON.stringify({
      villaId, sort, id: last.id, createdAt: last.createdAt, rating: last.rating,
    } satisfies ReviewCursor)).toString("base64url") : null;
    return { items, nextCursor };
  }, ["villa-review-page", villaId, sort, cursor ?? ""], {
    tags: [CACHE_TAGS.villaReviews(villaId)], revalidate: CACHE_REVALIDATE_SECONDS.villaReviews,
  });
  const [page, summary] = await Promise.all([loadPage(), getVillaReviewSummary(villaId)]);
  return { ...page, summary };
}

/** Best effort cleanup only for assets whose review transaction never committed. */
export async function removeUploadedReviewAssets(paths: string[]): Promise<void> {
  if (!paths.length) return;
  try { await createVillaReviewsClient().storage.from(BUCKET).remove(paths); } catch { /* Preserve the original write error. */ }
}

export async function verifyVillaReviewBooking(
  input: Pick<ReviewSubmissionInput, "villaId" | "bookingCode" | "phone">,
): Promise<void> {
  validateVillaId(input.villaId.trim());
  const bookingCode = input.bookingCode.trim();
  const expectedPhone = normalizeThaiPhone(input.phone);
  const fieldErrors: Record<string, string> = {};
  if (!bookingCode) fieldErrors.bookingCode = "กรุณากรอกรหัสการจอง";
  if (!expectedPhone) fieldErrors.phone = "กรุณากรอกเบอร์โทรศัพท์ไทยให้ถูกต้อง";
  if (Object.keys(fieldErrors).length) {
    throw new VillaReviewError(
      "validation_error",
      "ข้อมูลการเข้าพักไม่ถูกต้อง",
      false,
      fieldErrors,
    );
  }
  const client = createBookingVerificationClient();
  const booking = await client
    .from("bookings")
    .select("customer_id,listing_id")
    .eq("booking_code", bookingCode)
    .maybeSingle();
  if (booking.error) {
    throw new VillaReviewError(
      "booking_verification_unavailable",
      "ยังตรวจสอบข้อมูลการจองไม่ได้ กรุณาลองอีกครั้ง",
    );
  }
  if (!booking.data || booking.data.customer_id === null || booking.data.listing_id === null) {
    throw new VillaReviewError(
      "booking_verification_failed",
      "ไม่พบข้อมูลการจองที่ตรงกัน",
      false,
      { bookingCode: "ไม่พบข้อมูลการจองที่ตรงกัน" },
    );
  }
  const [customer, listing] = await Promise.all([
    client.from("customers").select("phone").eq("id", booking.data.customer_id).maybeSingle(),
    client.from("listings").select("property_id").eq("id", booking.data.listing_id).maybeSingle(),
  ]);
  if (customer.error || listing.error) {
    throw new VillaReviewError(
      "booking_verification_unavailable",
      "ยังตรวจสอบข้อมูลการจองไม่ได้ กรุณาลองอีกครั้ง",
    );
  }
  const verifiedPhone =
    customer.data && typeof customer.data.phone === "string"
      ? normalizeThaiPhone(customer.data.phone)
      : null;
  const verifiedVillaId =
    listing.data &&
    (typeof listing.data.property_id === "string" ||
      typeof listing.data.property_id === "number")
      ? String(listing.data.property_id)
      : null;
  if (!verifiedPhone || verifiedPhone !== expectedPhone || verifiedVillaId !== input.villaId.trim()) {
    throw new VillaReviewError(
      "booking_verification_failed",
      "ไม่พบข้อมูลการจองที่ตรงกัน",
      false,
      { bookingCode: "ไม่พบข้อมูลการจองที่ตรงกัน" },
    );
  }
}

export async function submitVillaReview(input: ReviewSubmissionInput, files: File[]): Promise<PublicVillaReview> {
  const validation = validateReviewSubmission(input);
  const fileValidation = validateReviewFiles(files);
  if (!validation.ok || !fileValidation.ok) {
    throw new VillaReviewError("validation_error", "กรุณาตรวจสอบข้อมูลรีวิว", false,
      { ...validation.fieldErrors, ...fileValidation.errors }, validation.detectedWords);
  }
  const villaId = input.villaId.trim();
  validateVillaId(villaId);
  await verifyVillaReviewBooking(input);
  const client = createVillaReviewsClient();
  const storage = client.storage.from(BUCKET);
  const requestId = crypto.randomUUID();
  const uploadedPaths: string[] = [];
  const images: { storage_path: string; public_url: string }[] = [];
  let commitOutcome: ReviewCommitOutcome = "uncommitted";
  let phase: "storage" | "database" = "storage";
  try {
    for (const file of files) {
      const extension = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();
      const path = `villa-reviews/${requestId}/${crypto.randomUUID()}.${extension}`;
      const result = await storage.upload(path, file, { contentType: file.type, upsert: false });
      if (result.error) throw new VillaReviewError("storage_error", "อัปโหลดรูปรีวิวไม่สำเร็จ");
      uploadedPaths.push(path);
      images.push({ storage_path: path, public_url: storage.getPublicUrl(path).data.publicUrl });
    }
    phase = "database";
    // The write may commit even if its response is lost or cannot be decoded.
    commitOutcome = "unknown";
    const result = await client.rpc("submit_villa_review", {
      p_villa_id: villaId, p_booking_code: input.bookingCode.trim(),
      p_phone_e164: normalizeThaiPhone(input.phone), p_rating: input.rating,
      p_comment: input.comment.trim(), p_images: images,
    });
    if (result.error) {
      if (!isConfirmedDatabaseRejection(result.status, result.error.code)) throw unknownSubmissionOutcome();
      commitOutcome = "uncommitted";
      const code = result.error.code === "23505" ? "duplicate_booking_code"
        : result.error.code === "22023" || result.error.code === "23514" ? "validation_error" : "database_error";
      const fieldErrors = code === "validation_error"
        ? rpcValidationFieldErrors(result.error.message)
        : {};
      throw new VillaReviewError(
        code,
        code === "duplicate_booking_code"
          ? "รหัสการจองนี้ใช้รีวิวแล้ว"
          : "บันทึกรีวิวไม่สำเร็จ",
        false,
        fieldErrors,
      );
    }
    if (result.status < 200 || result.status >= 300 || typeof result.data !== "string" || !UUID.test(result.data)) {
      throw unknownSubmissionOutcome();
    }
    commitOutcome = "committed";
    await revalidateVillaReviewsCache(villaId);
    const review = await client.from(PUBLIC_VIEW).select(PUBLIC_COLUMNS).eq("id", result.data).single();
    if (review.error || !review.data) throw new VillaReviewError("database_error", "บันทึกรีวิวแล้ว แต่โหลดผลลัพธ์ไม่สำเร็จ", true);
    return mapPublicReview(review.data as PublicRow);
  } catch (error) {
    if (commitOutcome === "uncommitted") await removeUploadedReviewAssets(uploadedPaths);
    if (commitOutcome === "unknown") throw unknownSubmissionOutcome();
    if (error instanceof VillaReviewError) throw error;
    throw new VillaReviewError(phase === "storage" ? "storage_error" : "database_error", "ดำเนินการรีวิวไม่สำเร็จ", commitOutcome === "committed");
  }
}
