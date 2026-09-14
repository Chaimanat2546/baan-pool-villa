import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseAdminReviewUpdate } from "../admin";
import { validateAdminReviewUpdate, validateReviewFiles } from "../validation";

const imageId = "00000000-0000-4000-8000-000000000001";

function fileOf(size: number, name = "review.jpg", type = "image/jpeg"): File {
  return { name, size, type } as File;
}

describe("admin villa review updates", () => {
  it.each([1, 5])("accepts rating %i with an optional empty comment", (rating) => {
    expect(validateAdminReviewUpdate({
      rating,
      comment: "   ",
      retainedImageIds: [imageId],
    })).toEqual({
      ok: true,
      value: { rating, comment: "", retainedImageIds: [imageId] },
      fieldErrors: {},
      detectedWords: [],
    });
  });

  it("accepts a 1,000-character comment and reports a prohibited word without returning the draft", () => {
    expect(validateAdminReviewUpdate({
      rating: 5,
      comment: "ก".repeat(1_000),
      retainedImageIds: [],
    }).ok).toBe(true);

    const draft = {
      rating: 4,
      comment: "บ้านเหี้ย but fuck",
      retainedImageIds: [imageId],
    };
    const result = validateAdminReviewUpdate(draft);

    expect(result.ok).toBe(false);
    expect(result.fieldErrors.comment).toContain("ความคิดเห็นมีคำที่ไม่เหมาะสม");
    expect(result.detectedWords).toEqual(expect.arrayContaining(["เหี้ย", "fuck"]));
    expect(JSON.stringify(result)).not.toContain(draft.comment);
  });

  it("reports field-addressable errors for invalid mutable review values", () => {
    const result = validateAdminReviewUpdate({
      rating: 6,
      comment: "ก".repeat(1_001),
      retainedImageIds: ["not-a-uuid", imageId, imageId],
    });

    expect(result.ok).toBe(false);
    expect(Object.keys(result.fieldErrors)).toEqual(
      expect.arrayContaining(["rating", "comment", "images"]),
    );
  });

  it("enforces the five-image total across retained and new files", () => {
    const result = validateReviewFiles(
      [fileOf(1), fileOf(1)],
      { existingImageCount: 4 },
    );

    expect(result).toEqual({
      ok: false,
      errors: { images: "แนบรูปได้สูงสุด 5 รูป" },
    });
  });

  it("accepts a comment and distinct retained image ids without exposing private review fields", () => {
    const result = parseAdminReviewUpdate({
      rating: 5,
      comment: "  บ้านสะอาดมาก  ",
      retainedImageIds: [
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
      ],
    });

    expect(result).toEqual({
      ok: true,
      value: {
        rating: 5,
        comment: "บ้านสะอาดมาก",
        retainedImageIds: [
          "00000000-0000-4000-8000-000000000001",
          "00000000-0000-4000-8000-000000000002",
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain("bookingCode");
    expect(JSON.stringify(result)).not.toContain("phoneE164");
  });

  it("rejects duplicate, malformed, and more than five retained image ids", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(parseAdminReviewUpdate({ rating: 5, comment: "", retainedImageIds: [id, id] })).toEqual({
      ok: false,
      errors: { images: "ข้อมูลรูปภาพไม่ถูกต้อง" },
    });
    expect(parseAdminReviewUpdate({ rating: 5, comment: "", retainedImageIds: ["not-a-uuid"] })).toEqual({
      ok: false,
      errors: { images: "ข้อมูลรูปภาพไม่ถูกต้อง" },
    });
    expect(parseAdminReviewUpdate({ rating: 5, comment: "", retainedImageIds: Array.from({ length: 6 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`) })).toEqual({
      ok: false,
      errors: { images: "แนบรูปได้สูงสุด 5 รูป" },
    });
  });
});
