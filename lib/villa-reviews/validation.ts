import { ProfanityFilter as ThaiProfanityFilter } from "bad-words-thai";

import type { ReviewSubmissionInput, ReviewValidationResult } from "./types";

import {
  MAX_REVIEW_COMMENT_LENGTH,
  normalizeThaiPhone,
} from "./input-validation";
export {
  MAX_REVIEW_IMAGES,
  MAX_REVIEW_IMAGE_BYTES,
  normalizeThaiPhone,
  validateReviewFiles,
} from "./input-validation";

const profanityFilter = new ThaiProfanityFilter({
  languages: ["thai", "english"],
});
await profanityFilter.initialize();

function addError(
  errors: Record<string, string>,
  field: string,
  message: string,
) {
  errors[field] = errors[field] ? `${errors[field]} ${message}` : message;
}

function exactDetectedSubstring(
  source: string,
  detected: {
    language: "thai" | "english" | "karaoke";
    length: number;
    originalWord: string;
    position: number;
  },
): string {
  const matchedPosition = source.indexOf(
    detected.originalWord,
    detected.position,
  );
  const start = matchedPosition === -1 ? detected.position : matchedPosition;
  let end = start + Math.max(detected.length, detected.originalWord.length);

  if (detected.language === "english") {
    while (/[a-z0-9]/i.test(source[end] ?? "")) end += 1;
  }

  return source.slice(start, end);
}

function detectProhibitedWords(comment: string): string[] {
  const thaiText = comment.replace(/[^\u0E00-\u0E7F\s]/g, " ");
  const englishText = comment.replace(/[^\x00-\x7F]/g, " ");
  const words = [thaiText, englishText].flatMap((text) =>
    text
      ? profanityFilter
          .check(text)
          .detectedWords.map((detected) =>
            exactDetectedSubstring(text, detected),
          )
      : [],
  );

  return [...new Set(words)];
}

export function maskThaiPhone(phone: string): string {
  return `xxx-xxxx-${phone.slice(-4)}`;
}

export function validateReviewSubmission(
  input: ReviewSubmissionInput,
): ReviewValidationResult {
  const fieldErrors: Record<string, string> = {};
  const detectedWords: string[] = [];
  const villaId = input.villaId.trim();
  const bookingCode = input.bookingCode.trim();
  const comment = input.comment.trim();

  if (!villaId) addError(fieldErrors, "villaId", "ไม่พบข้อมูลบ้านพัก");
  if (!bookingCode) addError(fieldErrors, "bookingCode", "กรุณากรอกรหัสการจอง");
  if (!normalizeThaiPhone(input.phone)) {
    addError(fieldErrors, "phone", "กรุณากรอกเบอร์โทรศัพท์ไทยให้ถูกต้อง");
  }
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    addError(fieldErrors, "rating", "กรุณาเลือกคะแนนรีวิว 1 ถึง 5");
  }
  if (comment.length > MAX_REVIEW_COMMENT_LENGTH) {
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

  return {
    ok: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    detectedWords,
  };
}
