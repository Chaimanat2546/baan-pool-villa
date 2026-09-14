import "server-only";

import { reservePublicApiRateLimit } from "@/lib/api/rate-limit";
import {
  getVillaReviewPage,
  submitVillaReview,
  verifyVillaReviewBooking,
  validateVillaId,
  validateVillaReviewCursor,
  VillaReviewError,
} from "./server";
import type { PublicVillaReview, ReviewSubmissionInput } from "./types";
import { validateReviewFiles, validateReviewSubmission } from "./validation";

function json(body: unknown, status = 200) {
  // Data reads are cached by the repository's per-villa tag. Avoid a second
  // response cache that would outlive successful submission invalidation.
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function publicReview(review: PublicVillaReview): PublicVillaReview {
  return {
    id: review.id,
    villaId: review.villaId,
    rating: review.rating,
    comment: review.comment,
    maskedPhone: review.maskedPhone,
    images: review.images.map((image) => ({ id: image.id, url: image.url })),
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

function errorResponse(error: unknown) {
  if (error instanceof VillaReviewError) {
    switch (error.code) {
      case "duplicate_booking_code":
        return json({
          error: "รหัสการจองนี้เคยใช้รีวิวแล้ว",
          fieldErrors: { bookingCode: "รหัสการจองนี้เคยใช้รีวิวแล้ว" },
        }, 409);
      case "booking_verification_unavailable":
        return json({ error: "ยังตรวจสอบข้อมูลการจองไม่ได้ กรุณาลองอีกครั้ง" }, 503);
      case "validation_error":
      case "booking_verification_failed":
      case "invalid_cursor":
        return json({
          error: "กรุณาตรวจสอบข้อมูลรีวิว",
          fieldErrors: error.fieldErrors,
          detectedWords: error.detectedWords,
        }, 400);
      default:
        break;
    }
  }
  return json({ error: "ดำเนินการรีวิวไม่สำเร็จ กรุณาลองอีกครั้งภายหลัง" }, 500);
}

export async function getPublicVillaReviews(request: Request, villaId: string) {
  try {
    validateVillaId(villaId);
    const query = new URL(request.url).searchParams;
    const sort = query.get("sort") ?? "newest";
    if (sort !== "newest" && sort !== "rating_desc" && sort !== "rating_asc") {
      throw new VillaReviewError("validation_error", "Invalid sort");
    }
    const cursor = query.get("cursor");
    validateVillaReviewCursor(villaId, sort, cursor);
    const page = await getVillaReviewPage(villaId, sort, cursor);
    const { averageRating, totalCount, ratingCounts } = page.summary;
    return json({
      summary: { averageRating, totalCount, ratingCounts: {
        1: ratingCounts[1], 2: ratingCounts[2], 3: ratingCounts[3],
        4: ratingCounts[4], 5: ratingCounts[5],
      } },
      items: page.items.map(publicReview),
      nextCursor: page.nextCursor,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function textField(form: FormData, key: string): string {
  const values = form.getAll(key);
  if (values.length > 1 || (values.length === 1 && typeof values[0] !== "string")) {
    throw new VillaReviewError("validation_error", "Invalid form field");
  }
  return typeof values[0] === "string" ? values[0] : "";
}

function verificationErrorResponse(error: unknown) {
  if (
    error instanceof VillaReviewError &&
    (error.code === "validation_error" || error.code === "booking_verification_failed")
  ) {
    return json({ fieldErrors: error.fieldErrors }, 400);
  }
  if (error instanceof VillaReviewError && error.code === "booking_verification_unavailable") {
    return json({ error: "ยังตรวจสอบข้อมูลการจองไม่ได้ กรุณาลองอีกครั้ง" }, 503);
  }
  return json({ error: "ยังตรวจสอบข้อมูลการจองไม่ได้ กรุณาลองอีกครั้ง" }, 500);
}

export async function postPublicVillaReviewVerification(
  request: Request,
  villaId: string,
) {
  try {
    validateVillaId(villaId);
    if (request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
      throw new VillaReviewError("validation_error", "Invalid content type");
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new VillaReviewError("validation_error", "Invalid JSON body");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new VillaReviewError("validation_error", "Invalid JSON body");
    }
    const value = body as Record<string, unknown>;
    await verifyVillaReviewBooking({
      villaId,
      bookingCode: typeof value.bookingCode === "string" ? value.bookingCode : "",
      phone: typeof value.phone === "string" ? value.phone : "",
    });
    return json({ ok: true });
  } catch (error) {
    return verificationErrorResponse(error);
  }
}

export async function postPublicVillaReview(request: Request, villaId: string) {
  let input: ReviewSubmissionInput;
  let files: File[];
  try {
    validateVillaId(villaId);
    if (request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() !== "multipart/form-data") {
      throw new VillaReviewError("validation_error", "Invalid content type");
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new VillaReviewError("validation_error", "Invalid multipart body");
    }
    input = {
      villaId,
      bookingCode: textField(form, "bookingCode"),
      phone: textField(form, "phone"),
      rating: Number(textField(form, "rating")),
      comment: textField(form, "comment"),
    };
    const images = form.getAll("images");
    if (images.some((image) => typeof image === "string")) {
      return json({ error: "กรุณาตรวจสอบข้อมูลรีวิว", fieldErrors: { images: "กรุณาเลือกไฟล์รูปภาพ" } }, 400);
    }
    files = images as File[];
    const validation = validateReviewSubmission(input);
    const fileValidation = validateReviewFiles(files);
    if (!validation.ok || !fileValidation.ok) {
      return json({
        error: "กรุณาตรวจสอบข้อมูลรีวิว",
        fieldErrors: { ...validation.fieldErrors, ...fileValidation.errors },
        detectedWords: validation.detectedWords,
      }, 400);
    }
  } catch (error) {
    return errorResponse(error);
  }

  const reservation = reservePublicApiRateLimit(request, "publicReviewSubmission");
  if (reservation.response) return reservation.response;

  try {
    const review = await submitVillaReview(input, files);
    reservation.commit();
    return json({ review: publicReview(review) }, 201);
  } catch (error) {
    // Only an explicit, confirmed rollback permits releasing a reserved slot.
    // Unknown errors can follow a successful write whose acknowledgement failed.
    if (error instanceof VillaReviewError && !error.shouldConsumeQuota) {
      reservation.release();
    } else {
      reservation.commit();
    }
    return errorResponse(error);
  }
}
