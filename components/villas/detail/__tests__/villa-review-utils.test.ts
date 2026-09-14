import { describe, expect, it } from "vitest";
import {
  formatRelativeReviewTime,
  safeReviewImageUrl,
} from "../villa-review-utils";

describe("review presentation", () => {
  it("uses stable Thai relative text and handles invalid and future times", () => {
    const now = Date.parse("2026-09-07T12:00:00Z");
    expect(formatRelativeReviewTime("2026-09-05T12:00:00Z", now)).toBe(
      "2 วันที่แล้ว",
    );
    expect(formatRelativeReviewTime("2026-09-07T11:55:00Z", now)).toBe(
      "5 นาทีที่แล้ว",
    );
    expect(formatRelativeReviewTime("invalid", now)).toBe("ไม่ทราบเวลา");
    expect(formatRelativeReviewTime("2027-09-07T12:00:00Z", now)).toBe(
      "เมื่อสักครู่",
    );
  });
  it("rejects unsafe image URL protocols", () => {
    expect(safeReviewImageUrl("javascript:alert(1)")).toBeNull();
    expect(safeReviewImageUrl("https://images.example.com/review.jpg")).toBe(
      "https://images.example.com/review.jpg",
    );
    expect(
      safeReviewImageUrl("http://127.0.0.1:55321/storage/v1/object/public/villa-reviews/image.jpg"),
    ).toBe(
      "http://127.0.0.1:55321/storage/v1/object/public/villa-reviews/image.jpg",
    );
    expect(safeReviewImageUrl("http://images.example.com/review.jpg")).toBeNull();
  });
});
