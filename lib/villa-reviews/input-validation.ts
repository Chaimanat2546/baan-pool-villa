import type { ReviewFileValidationResult } from "./types";

// Shared by the browser draft and server validation; contains no profanity dictionary.
export const MAX_REVIEW_IMAGES = 5;
export const MAX_REVIEW_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_REVIEW_COMMENT_LENGTH = 1_000;

export function normalizeThaiPhone(value: string): string | null {
  const normalized = value.trim().replace(/[\s-]/g, "");
  if (/^0\d{9}$/.test(normalized)) return `+66${normalized.slice(1)}`;
  return /^\+66\d{9}$/.test(normalized) ? normalized : null;
}

export function validateReviewFiles(
  files: File[],
  options: { existingImageCount?: number } = {},
): ReviewFileValidationResult {
  const errors: Record<string, string> = {};
  const existingImageCount = options.existingImageCount ?? 0;
  if (files.length + existingImageCount > MAX_REVIEW_IMAGES) {
    errors.images = "แนบรูปได้สูงสุด 5 รูป";
  }
  files.forEach((file, index) => {
    const messages: string[] = [];
    if (file.size > MAX_REVIEW_IMAGE_BYTES)
      messages.push("รูปแต่ละรูปต้องไม่เกิน 5 MB");
    const extension = file.name
      .slice(file.name.lastIndexOf(".") + 1)
      .toLowerCase();
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.name.lastIndexOf(".") < 1 ||
      !["jpg", "jpeg", "png", "webp"].includes(extension)
    )
      messages.push("ชนิดไฟล์รูปไม่รองรับ");
    if (messages.length) errors[`images.${index}`] = messages.join(" ");
  });
  return { errors, ok: Object.keys(errors).length === 0 };
}
