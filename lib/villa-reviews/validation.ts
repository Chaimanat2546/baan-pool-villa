import { detectProhibitedWords } from "./profanity";

import type {
  AdminReviewUpdateInput,
  AdminReviewUpdateValidationResult,
  AdminReviewUpdateValue,
  ReviewSubmissionInput,
  ReviewValidationResult,
} from "./types";

import {
  MAX_REVIEW_COMMENT_LENGTH,
  MAX_REVIEW_IMAGES,
  normalizeThaiPhone,
} from "./input-validation";
export {
  MAX_REVIEW_IMAGES,
  MAX_REVIEW_IMAGE_BYTES,
  normalizeThaiPhone,
  validateReviewFiles,
} from "./input-validation";

function addError(
  errors: Record<string, string>,
  field: string,
  message: string,
) {
  errors[field] = errors[field] ? `${errors[field]} ${message}` : message;
}

function validateReviewContent(input: {
  rating: unknown;
  comment: unknown;
}): {
  rating: number | null;
  comment: string | null;
  fieldErrors: Record<string, string>;
  detectedWords: string[];
} {
  const fieldErrors: Record<string, string> = {};
  const detectedWords: string[] = [];
  const rating = typeof input.rating === "number" ? input.rating : null;
  const comment = typeof input.comment === "string" ? input.comment.trim() : null;

  if (rating === null || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    addError(fieldErrors, "rating", "กรุณาเลือกคะแนนรีวิว 1 ถึง 5");
  }
  if (comment === null || comment.length > MAX_REVIEW_COMMENT_LENGTH) {
    addError(
      fieldErrors,
      "comment",
      "ความคิดเห็นต้องมีความยาวไม่เกิน 1,000 ตัวอักษร",
    );
  }
  if (comment) {
    detectedWords.push(...detectProhibitedWords(comment));
    if (detectedWords.length) {
      addError(fieldErrors, "comment", "ความคิดเห็นมีคำที่ไม่เหมาะสม");
    }
  }

  return { rating, comment, fieldErrors, detectedWords };
}

export function maskThaiPhone(phone: string): string {
  return `xxx-xxxx-${phone.slice(-4)}`;
}

export function validateReviewSubmission(
  input: ReviewSubmissionInput,
): ReviewValidationResult {
  const fieldErrors: Record<string, string> = {};
  const villaId = input.villaId.trim();
  const bookingCode = input.bookingCode.trim();
  const content = validateReviewContent(input);

  if (!villaId) addError(fieldErrors, "villaId", "ไม่พบข้อมูลบ้านพัก");
  if (!bookingCode) addError(fieldErrors, "bookingCode", "กรุณากรอกรหัสการจอง");
  if (!normalizeThaiPhone(input.phone)) {
    addError(fieldErrors, "phone", "กรุณากรอกเบอร์โทรศัพท์ไทยให้ถูกต้อง");
  }
  for (const [field, message] of Object.entries(content.fieldErrors)) {
    addError(fieldErrors, field, message);
  }

  return {
    ok: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    detectedWords: content.detectedWords,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateAdminReviewUpdate(
  input: AdminReviewUpdateInput,
): AdminReviewUpdateValidationResult {
  const content = validateReviewContent(input);
  const fieldErrors = { ...content.fieldErrors };
  const retainedImageIds = input.retainedImageIds;

  if (
    !Array.isArray(retainedImageIds) ||
    retainedImageIds.some((id) => typeof id !== "string" || !UUID.test(id)) ||
    new Set(retainedImageIds).size !== retainedImageIds.length
  ) {
    addError(fieldErrors, "images", "ข้อมูลรูปภาพไม่ถูกต้อง");
  } else if (retainedImageIds.length > MAX_REVIEW_IMAGES) {
    addError(fieldErrors, "images", "แนบรูปได้สูงสุด 5 รูป");
  }

  if (Object.keys(fieldErrors).length > 0 || content.rating === null || content.comment === null) {
    return {
      ok: false,
      fieldErrors,
      detectedWords: content.detectedWords,
    };
  }

  return {
    ok: true,
    value: {
      rating: content.rating,
      comment: content.comment,
      retainedImageIds: retainedImageIds as AdminReviewUpdateValue["retainedImageIds"],
    },
    fieldErrors: {},
    detectedWords: [],
  };
}
