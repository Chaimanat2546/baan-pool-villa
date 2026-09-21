import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewSubmissionInput } from "../types";

const fake = vi.hoisted(() => ({
  from: vi.fn(), rpc: vi.fn(), upload: vi.fn(), remove: vi.fn(),
  publicUrl: vi.fn(), cache: vi.fn(), invalidate: vi.fn(),
}));
const bookingVerification = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: fake.cache }));
vi.mock("@/lib/cache-revalidation", () => ({ revalidateVillaReviewsCache: fake.invalidate }));
vi.mock("../supabase", () => ({ createVillaReviewsClient: () => ({
  from: fake.from, rpc: fake.rpc,
  storage: { from: () => ({ upload: fake.upload, remove: fake.remove, getPublicUrl: fake.publicUrl }) },
}) }));
vi.mock("../booking-verification-supabase", () => ({
  createBookingVerificationClient: () => ({ from: bookingVerification.from }),
}));

import { getVillaReviewPage, getVillaReviewSummary, submitVillaReview, verifyVillaReviewBooking } from "../server";

const row = (index = 1) => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  villa_id: "villa-1", rating: 5, comment: "บ้านสะอาด", masked_phone: "xxx-xxxx-5678",
  created_at: "2026-09-07T00:00:00.123456+00:00", updated_at: "2026-09-07T00:00:00.123456+00:00",
  images: [{ id: "image-1", url: "https://example.com/photo.jpg", storage_path: "private" }],
  booking_code: "SECRET", phone_e164: "+66812345678",
});
const validInput = (): ReviewSubmissionInput => ({ villaId: " villa-1 ", bookingCode: " BOOK-1 ", phone: "081-234-5678", rating: 5, comment: " บ้านสะอาด " });
const files = () => [new File(["one"], "one.jpg", { type: "image/jpeg" }), new File(["two"], "two.png", { type: "image/png" })];

function query(data: unknown, count: number | null = 0, error: unknown = null) {
  const result = { data, count, error };
  const builder = {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), or: vi.fn(), retry: vi.fn(), single: vi.fn(), maybeSingle: vi.fn(),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const method of [builder.select, builder.eq, builder.order, builder.limit, builder.or, builder.retry, builder.single, builder.maybeSingle]) method.mockReturnValue(builder);
  return builder;
}

function verificationQueries(
  booking: unknown = { customer_id: 1, listing_id: "listing-1" },
  customer: unknown = { phone: "+66812345678" },
  listing: unknown = { property_id: "villa-1" },
) {
  return (table: string) => {
    if (table === "bookings") return query(booking);
    if (table === "customers") return query(customer);
    if (table === "listings") return query(listing);
    throw new Error(`Unexpected verification table: ${table}`);
  };
}

describe("villa review repository", () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    vi.resetAllMocks();
    fake.cache.mockImplementation((fn) => fn);
    fake.upload.mockResolvedValue({ data: {}, error: null });
    fake.remove.mockResolvedValue({ data: [], error: null });
    fake.publicUrl.mockImplementation((path) => ({ data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/villa-reviews/${path}` } }));
    fake.rpc.mockResolvedValue({ data: row().id, error: null, status: 200 });
    fake.from.mockImplementation(() => query({ phone: "+66812345678", property_id: "villa-1" }));
    bookingVerification.from.mockImplementation(verificationQueries());
  });

  it("maps only public fields, returns five items and preserves timestamp precision in opaque cursors", async () => {
    const pageQuery = query(Array.from({ length: 6 }, (_, index) => row(index + 1)));
    fake.from.mockReturnValue(pageQuery);
    const page = await getVillaReviewPage("villa-1", "newest", null);
    expect(page.items).toHaveLength(5);
    expect(Object.keys(page.items[0]).sort()).toEqual(["comment", "createdAt", "id", "images", "maskedPhone", "rating", "updatedAt", "villaId"]);
    expect(page.items[0].images).toEqual([{ id: "image-1", url: "https://example.com/photo.jpg" }]);
    expect(pageQuery.limit).toHaveBeenCalledWith(6);
    const cursor = JSON.parse(Buffer.from(page.nextCursor!, "base64url").toString());
    expect(cursor.createdAt).toBe("2026-09-07T00:00:00.123456+00:00");
    expect(fake.from.mock.calls.every(([table]) => table === "villa_reviews_public")).toBe(true);
    expect(fake.from.mock.results.every(({ value }) => value.retry.mock.calls.some((args: unknown[]) => args[0] === false))).toBe(true);
    expect(fake.cache).toHaveBeenCalledWith(expect.any(Function), expect.arrayContaining(["villa-1"]), { tags: ["villa-reviews:villa-1"], revalidate: 43200 });
  });

  it("falls back to a direct review read when the review cache rejects", async () => {
    fake.cache.mockImplementation(() => () => Promise.reject(new Error("cache unavailable")));
    fake.from.mockReturnValue(query([]));

    await expect(getVillaReviewPage("villa-1", "newest", null)).resolves.toEqual({
      items: [],
      nextCursor: null,
      summary: {
        totalCount: 0,
        averageRating: 0,
        ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      },
    });
    expect(fake.from).toHaveBeenCalledTimes(6);
  });

  it("does not retry a database error raised while filling the review cache", async () => {
    fake.from.mockReturnValue(query([], 0, { message: "database unavailable" }));

    await expect(getVillaReviewPage("villa-1", "newest", null)).rejects.toMatchObject({
      code: "database_error",
    });
    expect(fake.from).toHaveBeenCalledTimes(6);
  });

  it("falls back to a direct review read when the review cache does not resolve", async () => {
    vi.useFakeTimers();
    fake.cache.mockImplementation(() => () => new Promise(() => {}));
    fake.from.mockReturnValue(query([]));

    const pending = getVillaReviewPage("villa-1", "newest", null);
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(Promise.race([pending, Promise.resolve("cache still pending")])).resolves.toEqual({
      items: [],
      nextCursor: null,
      summary: {
        totalCount: 0,
        averageRating: 0,
        ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      },
    });
    expect(fake.from).toHaveBeenCalledTimes(6);
  });

  it("keeps local loopback review image URLs in development data", async () => {
    const localImageUrl =
      "http://127.0.0.1:55321/storage/v1/object/public/villa-reviews/villa-reviews/review/image.jpg";
    fake.from.mockReturnValue(query([{ ...row(), images: [{ id: "image-local", url: localImageUrl }] }]));

    const page = await getVillaReviewPage("villa-1", "newest", null);

    expect(page.items[0].images).toEqual([{ id: "image-local", url: localImageUrl }]);
  });

  it.each(["!", "e30", Buffer.from(JSON.stringify({ sort: "rating_asc", villaId: "villa-1", id: row().id, rating: 1 })).toString("base64url")])("rejects malformed or mismatched cursor before queries: %s", async (cursor) => {
    await expect(getVillaReviewPage("villa-1", "newest", cursor)).rejects.toMatchObject({ code: "invalid_cursor" });
    expect(fake.from).not.toHaveBeenCalled();
  });

  it.each(["newest", "rating_desc", "rating_asc"] as const)("uses stable keyset ordering for %s and rejects cross-villa cursors", async (sort) => {
    const builder = query(Array.from({ length: 6 }, (_, index) => row(index + 1)));
    fake.from.mockReturnValue(builder);
    const first = await getVillaReviewPage("villa-1", sort, null);
    await getVillaReviewPage("villa-1", sort, first.nextCursor);
    expect(builder.order).toHaveBeenCalledWith("id", { ascending: sort === "rating_asc" });
    expect(builder.or).toHaveBeenCalledWith(expect.stringContaining(`id.${sort === "rating_asc" ? "gt" : "lt"}.${row(5).id}`));
    fake.from.mockClear();
    await expect(getVillaReviewPage("villa-2", sort, first.nextCursor)).rejects.toMatchObject({ code: "invalid_cursor" });
    expect(fake.from).not.toHaveBeenCalled();
  });

  it("aggregates exact per-rating counts without downloading the review history", async () => {
    let ratingCount = 0;
    fake.from.mockImplementation(() => {
      const builder = query(null, ++ratingCount);
      return builder;
    });
    expect(await getVillaReviewSummary("villa-1")).toEqual({ totalCount: 15, averageRating: 55 / 15, ratingCounts: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 } });
    for (const result of fake.from.mock.results) {
      expect(result.value.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    }
  });

  it("validates before any storage or database work", async () => {
    await expect(submitVillaReview({ ...validInput(), rating: 0 }, files())).rejects.toMatchObject({ code: "validation_error" });
    await expect(submitVillaReview(validInput(), [new File(["bad"], "bad.svg", { type: "image/svg+xml" })])).rejects.toMatchObject({ code: "validation_error" });
    expect(fake.upload).not.toHaveBeenCalled();
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("rejects a booking code whose customer phone cannot be verified before uploading", async () => {
    bookingVerification.from.mockImplementation(verificationQueries(null));

    await expect(submitVillaReview(validInput(), files())).rejects.toMatchObject({
      code: "booking_verification_failed",
      fieldErrors: { bookingCode: "ไม่พบข้อมูลการจองที่ตรงกัน" },
    });

    expect(bookingVerification.from).toHaveBeenCalledWith("bookings");
    expect(fake.upload).not.toHaveBeenCalled();
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("reads booking, customer, and listing verification data from Deville rather than the local review database", async () => {
    await verifyVillaReviewBooking(validInput());

    expect(bookingVerification.from.mock.calls.map(([table]) => table)).toEqual([
      "bookings",
      "customers",
      "listings",
    ]);
  });

  it("reports a Deville verification database failure without calling it a booking mismatch", async () => {
    bookingVerification.from.mockReturnValue(
      query(null, 0, { code: "42P01", message: "view missing" }),
    );

    await expect(verifyVillaReviewBooking(validInput())).rejects.toMatchObject({
      code: "booking_verification_unavailable",
      fieldErrors: {},
    });
  });

  it("rejects a verified phone when the booking belongs to another villa before uploading", async () => {
    bookingVerification.from.mockImplementation(
      verificationQueries(undefined, undefined, { property_id: "villa-other" }),
    );

    await expect(submitVillaReview(validInput(), files())).rejects.toMatchObject({
      code: "booking_verification_failed",
      fieldErrors: { bookingCode: "ไม่พบข้อมูลการจองที่ตรงกัน" },
    });

    expect(fake.upload).not.toHaveBeenCalled();
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("uploads all files before atomic RPC, normalizes fields and returns a public DTO", async () => {
    const booking = query({ customer_id: 1, listing_id: "listing-1" });
    const customer = query({ phone: "+66812345678" });
    const listing = query({ property_id: "villa-1" });
    const publicReview = query(row());
    bookingVerification.from.mockImplementation((table) => {
      if (table === "bookings") return booking;
      if (table === "customers") return customer;
      if (table === "listings") return listing;
      throw new Error(`Unexpected verification table: ${table}`);
    });
    fake.from.mockReturnValue(publicReview);
    const review = await submitVillaReview(validInput(), files());
    const paths = fake.upload.mock.calls.map(([path]) => path);
    expect(paths).toHaveLength(2);
    expect(paths.every((path) => /^villa-reviews\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png)$/.test(path))).toBe(true);
    expect(fake.rpc.mock.invocationCallOrder[0]).toBeGreaterThan(fake.upload.mock.invocationCallOrder[1]);
    expect(fake.rpc).toHaveBeenCalledWith("submit_villa_review", { p_villa_id: "villa-1", p_booking_code: "BOOK-1", p_phone_e164: "+66812345678", p_rating: 5, p_comment: "บ้านสะอาด", p_images: paths.map((path) => ({ storage_path: path, public_url: `https://example.supabase.co/storage/v1/object/public/villa-reviews/${path}` })) });
    expect(booking.select).toHaveBeenCalledWith("customer_id,listing_id");
    expect(booking.eq).toHaveBeenCalledWith("booking_code", "BOOK-1");
    expect(customer.select).toHaveBeenCalledWith("phone");
    expect(customer.eq).toHaveBeenCalledWith("id", 1);
    expect(listing.select).toHaveBeenCalledWith("property_id");
    expect(listing.eq).toHaveBeenCalledWith("id", "listing-1");
    expect(review.maskedPhone).toBe("xxx-xxxx-5678");
    expect(review).not.toHaveProperty("booking_code");
    expect(fake.invalidate).toHaveBeenCalledWith("villa-1");
    expect(fake.remove).not.toHaveBeenCalled();
  });

  it("cleans every uploaded path when RPC rejects duplicate booking", async () => {
    fake.rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key booking" }, status: 409 });
    fake.remove.mockRejectedValue(new Error("cleanup unavailable"));
    await expect(submitVillaReview(validInput(), files())).rejects.toMatchObject({ code: "duplicate_booking_code", committed: false, commitOutcome: "uncommitted", shouldConsumeQuota: false });
    expect(fake.remove).toHaveBeenCalledWith(fake.upload.mock.calls.map(([path]) => path));
    expect(fake.invalidate).not.toHaveBeenCalled();
  });

  it("returns a safe field error when the RPC rejects a normalized phone number", async () => {
    fake.rpc.mockResolvedValue({
      data: null,
      error: { code: "22023", message: "Invalid Thai phone number" },
      status: 400,
    });

    await expect(submitVillaReview(validInput(), files())).rejects.toMatchObject({
      code: "validation_error",
      fieldErrors: { phone: "กรุณากรอกเบอร์โทรศัพท์ไทยให้ถูกต้อง" },
    });
  });

  it("cleans the successful prefix when a later upload fails and skips RPC", async () => {
    fake.upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "upload failed" } });
    await expect(submitVillaReview(validInput(), files())).rejects.toMatchObject({ code: "storage_error" });
    expect(fake.remove).toHaveBeenCalledWith([fake.upload.mock.calls[0][0]]);
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("preserves committed assets and marks post-commit read failures", async () => {
    fake.from.mockReturnValue(query(null, null, { code: "XX000", message: "read failed" }));
    await expect(submitVillaReview(validInput(), files())).rejects.toMatchObject({ code: "database_error", committed: true, commitOutcome: "committed", shouldConsumeQuota: true });
    expect(fake.remove).not.toHaveBeenCalled();
  });

  it.each([
    { data: null, error: { code: "", message: "TypeError: fetch failed" }, status: 0 },
    { data: null, error: { code: "23505", message: "corrupt acknowledgement" }, status: 0 },
    { data: null, error: { message: "gateway timeout" }, status: 504 },
    { data: null, error: { code: "40003", message: "statement completion unknown" }, status: 500 },
    { data: null, error: null, status: 200 },
  ])("retains files and quota when the RPC acknowledgement cannot confirm an outcome (%j)", async (result) => {
    fake.rpc.mockResolvedValue(result);
    await expect(submitVillaReview(validInput(), files())).rejects.toMatchObject({
      code: "submission_outcome_unknown", commitOutcome: "unknown", committed: false, shouldConsumeQuota: true,
    });
    expect(fake.remove).not.toHaveBeenCalled();
    expect(bookingVerification.from.mock.calls.map(([table]) => table)).toEqual(["bookings", "customers", "listings"]);
    expect(fake.invalidate).not.toHaveBeenCalled();
  });

  it("retains files and quota when the RPC promise rejects after dispatch", async () => {
    fake.rpc.mockRejectedValue(new TypeError("connection lost"));
    await expect(submitVillaReview(validInput(), files())).rejects.toMatchObject({
      code: "submission_outcome_unknown", commitOutcome: "unknown", shouldConsumeQuota: true,
    });
    expect(fake.remove).not.toHaveBeenCalled();
    expect(bookingVerification.from.mock.calls.map(([table]) => table)).toEqual(["bookings", "customers", "listings"]);
  });
});
