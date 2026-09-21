import { describe, expect, it } from "vitest";

import type { ReviewSubmissionInput } from "../types";
import {
  maskThaiPhone,
  normalizeThaiPhone,
  validateReviewFiles,
  validateReviewSubmission,
} from "../validation";

function fileOf(
  size: number,
  name = "review.jpg",
  type = "image/jpeg",
): File {
  return { name, size, type } as File;
}

function fiveFilesOf(size: number): File[] {
  return Array.from({ length: 5 }, () => fileOf(size));
}

function sixValidFiles(): File[] {
  return Array.from({ length: 6 }, () => fileOf(1));
}

function validInput(
  overrides: Partial<ReviewSubmissionInput> = {},
): ReviewSubmissionInput {
  return {
    bookingCode: "BOOKING-123",
    comment: "บ้านพักสะอาดและดูแลดี",
    phone: "0812349854",
    rating: 5,
    villaId: "villa-1",
    ...overrides,
  };
}

describe("villa review validation", () => {
  it("normalizes both accepted Thai phone forms and masks only the last four digits", () => {
    expect(normalizeThaiPhone("0812349854")).toBe("+66812349854");
    expect(normalizeThaiPhone("+66812349854")).toBe("+66812349854");
    expect(maskThaiPhone("+66812349854")).toBe("xxx-xxxx-9854");
  });

  it("accepts five 5 MB files but rejects one file above 5 MB and a sixth file", () => {
    expect(validateReviewFiles(fiveFilesOf(5 * 1024 * 1024))).toEqual({
      errors: {},
      ok: true,
    });
    expect(validateReviewFiles([fileOf(5 * 1024 * 1024 + 1)]).errors["images.0"]).toContain("5 MB");
    expect(validateReviewFiles(sixValidFiles()).errors.images).toContain("5 รูป");
  });

  it("checks file MIME type and extension independently", () => {
    const result = validateReviewFiles([
      fileOf(1, "review.exe", "image/jpeg"),
      fileOf(1, "review.jpg", "application/octet-stream"),
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors["images.0"]).toContain("ชนิดไฟล์");
    expect(result.errors["images.1"]).toContain("ชนิดไฟล์");
  });

  it("rejects a detected prohibited term without returning the original private form fields", () => {
    const input = validInput({ comment: "เหี้ย" });
    const result = validateReviewSubmission(input);

    expect(result.ok).toBe(false);
    expect(result.detectedWords.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain(input.phone);
    expect(JSON.stringify(result)).not.toContain(input.bookingCode);
  });

  it("accepts omitted or whitespace-only comments", () => {
    expect(validateReviewSubmission(validInput({ comment: "" })).ok).toBe(true);
    expect(validateReviewSubmission(validInput({ comment: "   " })).ok).toBe(true);
  });

  it("accepts a 1,000-character comment but rejects 1,001 characters", () => {
    expect(validateReviewSubmission(validInput({ comment: "ก".repeat(1_000) })).ok).toBe(true);

    const result = validateReviewSubmission(validInput({ comment: "ก".repeat(1_001) }));

    expect(result.ok).toBe(false);
    expect(result.fieldErrors.comment).toContain("1,000");
  });

  it("detects Thai and English prohibited words in the same comment", () => {
    const result = validateReviewSubmission(
      validInput({ comment: "บ้านเหี้ย but fuck" }),
    );

    expect(result.ok).toBe(false);
    expect(result.detectedWords).toEqual(
      expect.arrayContaining(["เหี้ย", "fuck"]),
    );
  });

  it.each([
    ["บ้านเหี้ย but FUCK!", ["เหี้ย", "FUCK"]],
    ["ค;ว;ย", ["ค;ว;ย"]],
    ["คุวย", ["คุวย"]],
    ["หีบ เหี้ย", ["เหี้ย"]],
    ["fuck fuck", ["fuck"]],
  ])("retains dictionary, evasion, allowlist and original text handling: %s", (comment, detectedWords) => {
    expect(validateReviewSubmission(validInput({ comment })).detectedWords).toEqual(detectedWords);
  });

  it.each(["หีบ หิมะ หิน", "บ้านสะอาด great stay", "comfortable classic room"])("accepts clean text: %s", (comment) => {
    expect(validateReviewSubmission(validInput({ comment })).ok).toBe(true);
  });

  it("reports field-keyed errors for malformed required review values", () => {
    const result = validateReviewSubmission(
      validInput({ bookingCode: " ", comment: " ", phone: "123", rating: 6, villaId: " " }),
    );

    expect(result.ok).toBe(false);
    expect(Object.keys(result.fieldErrors)).toEqual(
      expect.arrayContaining(["villaId", "bookingCode", "phone", "rating"]),
    );
  });

  it("preserves the public submission validation result after content validation extraction", () => {
    expect(validateReviewSubmission(validInput({
      bookingCode: " ",
      comment: " ",
      phone: "123",
      rating: 0,
      villaId: " ",
    }))).toEqual({
      ok: false,
      fieldErrors: {
        villaId: "ไม่พบข้อมูลบ้านพัก",
        bookingCode: "กรุณากรอกรหัสการจอง",
        phone: "กรุณากรอกเบอร์โทรศัพท์ไทยให้ถูกต้อง",
        rating: "กรุณาเลือกคะแนนรีวิว 1 ถึง 5",
      },
      detectedWords: [],
    });
  });
});
