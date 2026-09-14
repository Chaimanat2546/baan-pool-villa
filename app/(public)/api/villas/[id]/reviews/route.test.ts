import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicVillaReview, ReviewSort } from "@/lib/villa-reviews/types";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/villa-reviews/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/villa-reviews/server")>();
  return { ...actual, getVillaReviewPage: vi.fn(), submitVillaReview: vi.fn() };
});

import { resetPublicRateLimitForTests } from "@/lib/api/rate-limit";
import { getVillaReviewPage, submitVillaReview, VillaReviewError } from "@/lib/villa-reviews/server";
import { GET, POST } from "./route";

const phone = "0812345678";
const bookingCode = "PRIVATE-BOOKING-123";
const review: PublicVillaReview = {
  id: "00000000-0000-4000-8000-000000000001", villaId: "villa-1", rating: 5,
  comment: "บ้านสะอาด", maskedPhone: "xxx-xxxx-5678", images: [],
  createdAt: "2026-09-07T00:00:00Z", updatedAt: "2026-09-07T00:00:00Z",
};
const summary = { totalCount: 1, averageRating: 5, ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 } };
const context = (id = "villa-1") => ({ params: Promise.resolve({ id }) });
function postRequest(fields: Record<string, string> = {}, files: File[] = []) {
  const body = new FormData();
  for (const [key, value] of Object.entries({ bookingCode, phone, rating: "5", comment: "บ้านสะอาด", ...fields })) body.append(key, value);
  files.forEach((file) => body.append("images", file));
  return new Request("https://example.com/api/villas/villa-1/reviews", {
    method: "POST", body, headers: { "CF-Connecting-IP": "203.0.113.1" },
  });
}
function cursor(sort: ReviewSort = "newest", villaId = "villa-1") {
  return Buffer.from(JSON.stringify({ villaId, sort, id: review.id, createdAt: review.createdAt, rating: 5 })).toString("base64url");
}

beforeEach(() => {
  vi.clearAllMocks();
  resetPublicRateLimitForTests();
  vi.mocked(getVillaReviewPage).mockResolvedValue({ summary, items: [review], nextCursor: null });
  vi.mocked(submitVillaReview).mockResolvedValue(review);
});

describe("public villa review GET", () => {
  it.each(["newest", "rating_desc", "rating_asc"] as const)("passes validated %s ordering and cursor and returns the public page", async (sort) => {
    const after = cursor(sort);
    const response = await GET(new Request(`https://example.com/api/villas/villa-1/reviews?sort=${sort}&cursor=${after}`), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ summary, items: [review], nextCursor: null });
    expect(getVillaReviewPage).toHaveBeenCalledWith("villa-1", sort, after);
  });

  it("defaults to newest and omits private repository properties", async () => {
    vi.mocked(getVillaReviewPage).mockResolvedValue({ summary, items: [{ ...review, bookingCode, phone }], nextCursor: null } as unknown as Awaited<ReturnType<typeof getVillaReviewPage>>);
    const response = await GET(new Request("https://example.com/api/villas/villa-1/reviews"), context());
    expect(await response.json()).toEqual({ summary, items: [review], nextCursor: null });
    expect(getVillaReviewPage).toHaveBeenCalledWith("villa-1", "newest", null);
  });

  it.each(["?sort=bad", "?sort=", "?cursor=", "?cursor=bad!", "?cursor=e30", `?cursor=${cursor("rating_asc")}`, `?cursor=${cursor("newest", "other")}`])("rejects invalid query before reads: %s", async (query) => {
    const response = await GET(new Request(`https://example.com/api/villas/villa-1/reviews${query}`), context());
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(getVillaReviewPage).not.toHaveBeenCalled();
  });

  it.each(["", " ", "x".repeat(201)])("rejects an invalid path ID", async (id) => {
    expect((await GET(new Request("https://example.com/api/villas/x/reviews"), context(id))).status).toBe(400);
    expect(getVillaReviewPage).not.toHaveBeenCalled();
  });

  it("sanitizes unexpected read errors", async () => {
    vi.mocked(getVillaReviewPage).mockRejectedValue(new Error(`${bookingCode} ${phone}`));
    const response = await GET(new Request("https://example.com/api/villas/villa-1/reviews"), context());
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.text();
    expect(body).not.toContain(bookingCode);
    expect(body).not.toContain(phone);
  });
});

describe("public villa review POST", () => {
  it("returns only the public DTO and forwards repeated image fields", async () => {
    const files = [new File(["one"], "one.jpg", { type: "image/jpeg" }), new File(["two"], "two.png", { type: "image/png" })];
    vi.mocked(submitVillaReview).mockResolvedValue({ ...review, phone, bookingCode } as PublicVillaReview);
    const response = await POST(postRequest({}, files), context());
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ review });
    expect(submitVillaReview).toHaveBeenCalledWith({ villaId: "villa-1", bookingCode, phone, rating: 5, comment: "บ้านสะอาด" }, expect.arrayContaining([expect.objectContaining({ name: "one.jpg" }), expect.objectContaining({ name: "two.png" })]));
  });

  it("returns 409 for a reused booking without echoing private data", async () => {
    vi.mocked(submitVillaReview).mockRejectedValue(new VillaReviewError("duplicate_booking_code", `${bookingCode} ${phone}`));
    const response = await POST(postRequest(), context());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "รหัสการจองนี้เคยใช้รีวิวแล้ว",
      fieldErrors: { bookingCode: "รหัสการจองนี้เคยใช้รีวิวแล้ว" },
    });
  });

  it("returns safe field errors from a rejected write instead of hiding them behind a generic message", async () => {
    vi.mocked(submitVillaReview).mockRejectedValue(
      new VillaReviewError(
        "validation_error",
        "กรุณาตรวจสอบข้อมูลรีวิว",
        false,
        { comment: "ความคิดเห็นมีคำที่ไม่เหมาะสม" },
        ["คำไม่เหมาะสม"],
      ),
    );

    const response = await POST(postRequest(), context());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "กรุณาตรวจสอบข้อมูลรีวิว",
      fieldErrors: { comment: "ความคิดเห็นมีคำที่ไม่เหมาะสม" },
      detectedWords: ["คำไม่เหมาะสม"],
    });
  });

  it("does not reveal which booking field failed verification", async () => {
    vi.mocked(submitVillaReview).mockRejectedValue(
      new VillaReviewError(
        "booking_verification_failed",
        `${bookingCode} ${phone}`,
        false,
        { bookingCode: "ไม่พบข้อมูลการจองที่ตรงกัน" },
      ),
    );

    const response = await POST(postRequest(), context());

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: "กรุณาตรวจสอบข้อมูลรีวิว",
      fieldErrors: { bookingCode: "ไม่พบข้อมูลการจองที่ตรงกัน" },
      detectedWords: [],
    });
    expect(JSON.stringify(body)).not.toContain(bookingCode);
    expect(JSON.stringify(body)).not.toContain(phone);
  });

  it("rejects an oversized later image with its own field error", async () => {
    const files = [new File(["1"], "small.jpg", { type: "image/jpeg" }), new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.jpg", { type: "image/jpeg" })];
    const response = await POST(postRequest({}, files), context());
    expect(response.status).toBe(400);
    expect((await response.json()).fieldErrors["images.1"]).toContain("5 MB");
    expect(submitVillaReview).not.toHaveBeenCalled();
  });

  const invalidFields: Array<Record<string, string>> = [{ phone: "wrong" }, { bookingCode: "" }, { rating: "1.5" }, { rating: "6" }, { comment: "x".repeat(1001) }, { comment: "fuck" }];
  it.each(invalidFields)("rejects invalid submissions without spending quota: %j", async (fields) => {
    for (let i = 0; i < 6; i++) expect((await POST(postRequest(fields), context())).status).toBe(400);
    expect(submitVillaReview).not.toHaveBeenCalled();
    for (let i = 0; i < 5; i++) expect((await POST(postRequest(), context())).status).toBe(201);
  });

  it("rejects invalid IDs before writes", async () => {
    expect((await POST(postRequest(), context("x".repeat(201)))).status).toBe(400);
    expect(submitVillaReview).not.toHaveBeenCalled();
  });

  it("rejects malformed multipart bodies safely", async () => {
    const request = new Request("https://example.com/api/villas/villa-1/reviews", { method: "POST", headers: { "Content-Type": "multipart/form-data" }, body: `${phone} ${bookingCode}` });
    const response = await POST(request, context());
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain(bookingCode);
    expect(submitVillaReview).not.toHaveBeenCalled();
  });

  it("requires multipart form data for submissions", async () => {
    const request = new Request("https://example.com/api/villas/villa-1/reviews", {
      method: "POST", body: new URLSearchParams({ bookingCode, phone, rating: "5", comment: "บ้านสะอาด" }),
    });
    expect((await POST(request, context())).status).toBe(400);
    expect(submitVillaReview).not.toHaveBeenCalled();
  });

  it.each(["duplicate-rating", "file-phone", "text-image"])("rejects malformed multipart field %s", async (kind) => {
    const body = await postRequest().formData();
    if (kind === "duplicate-rating") body.append("rating", "1");
    if (kind === "file-phone") body.set("phone", new File([phone], "phone.txt"));
    if (kind === "text-image") body.append("images", "not an image");
    const request = new Request("https://example.com/api/villas/villa-1/reviews", { method: "POST", body });
    expect((await POST(request, context())).status).toBe(400);
    expect(submitVillaReview).not.toHaveBeenCalled();
  });

  it.each([
    [new File(["bad"], "image.svg", { type: "image/svg+xml" })],
    Array.from({ length: 6 }, () => new File(["small"], "image.jpg", { type: "image/jpeg" })),
  ])("rejects invalid image types and more than five images", async (...files) => {
    expect((await POST(postRequest({}, files), context())).status).toBe(400);
    expect(submitVillaReview).not.toHaveBeenCalled();
  });

  it("keeps concurrent pending submissions within five reserved slots", async () => {
    let finishWrites!: (value: PublicVillaReview) => void;
    const pendingWrite = new Promise<PublicVillaReview>((resolve) => { finishWrites = resolve; });
    vi.mocked(submitVillaReview).mockReturnValue(pendingWrite);
    const pendingRequests = Array.from({ length: 5 }, () => POST(postRequest(), context()));
    await vi.waitFor(() => expect(submitVillaReview).toHaveBeenCalledTimes(5));
    try {
      expect((await POST(postRequest(), context())).status).toBe(429);
    } finally {
      finishWrites(review);
    }
    expect((await Promise.all(pendingRequests)).map((response) => response.status)).toEqual([201, 201, 201, 201, 201]);
  });

  it("returns 429 with retry headers after five successful submissions", async () => {
    for (let i = 0; i < 5; i++) expect((await POST(postRequest(), context())).status).toBe(201);
    const response = await POST(postRequest(), context());
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(submitVillaReview).toHaveBeenCalledTimes(5);
  });

  it("releases confirmed uncommitted failures", async () => {
    vi.mocked(submitVillaReview).mockRejectedValue(new VillaReviewError("storage_error", `${phone} ${bookingCode}`));
    for (let i = 0; i < 6; i++) {
      const response = await POST(postRequest(), context());
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).not.toContain(phone);
      expect(text).not.toContain(bookingCode);
    }
    vi.mocked(submitVillaReview).mockResolvedValue(review);
    expect((await POST(postRequest(), context())).status).toBe(201);
  });

  it.each([true, "unknown"] as const)("retains quota for commit outcome %s", async (outcome) => {
    vi.mocked(submitVillaReview).mockRejectedValue(new VillaReviewError("database_error", `${phone} ${bookingCode}`, outcome));
    for (let i = 0; i < 5; i++) expect((await POST(postRequest(), context())).status).toBe(500);
    expect((await POST(postRequest(), context())).status).toBe(429);
  });

  it("retains quota conservatively for unexpected write exceptions", async () => {
    vi.mocked(submitVillaReview).mockRejectedValue(new Error(`${phone} ${bookingCode}`));
    for (let i = 0; i < 5; i++) expect((await POST(postRequest(), context())).status).toBe(500);
    expect((await POST(postRequest(), context())).status).toBe(429);
  });
});
