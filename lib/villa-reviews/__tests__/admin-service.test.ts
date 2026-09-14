import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), titles: vi.fn(), revalidate: vi.fn() }));
vi.mock("../supabase", () => ({ createVillaReviewsClient: mocks.client }));
vi.mock("@/lib/villas/server", () => ({ fetchVillaTitlesByIds: mocks.titles }));
vi.mock("@/lib/cache-revalidation", () => ({ revalidateVillaReviewsCache: mocks.revalidate }));

import { deleteAdminVillaReview, getAdminVillaReviewDetail, listAdminVillaReviews, updateAdminVillaReview } from "../admin";

const id = "00000000-0000-4000-8000-000000000001";
const editorId = "00000000-0000-4000-8000-000000000002";
const imageId = "00000000-0000-4000-8000-000000000003";
const base = { id, villa_id: "9", rating: 5, comment: "สะอาดมาก", masked_phone: "xxx-xxxx-5678", created_at: "2026-09-07T01:00:00.123456+00:00", updated_at: "2026-09-07T02:00:00Z" };
const image = { id: imageId, review_id: id, storage_path: "villa-reviews/old.jpg", public_url: "https://example.test/old.jpg", display_order: 1 };
const input = { rating: 4, comment: "  สะอาด  ", retainedImageIds: [imageId] };
const file = { name: "photo.jpg", size: 100, type: "image/jpeg" } as File;

function setup(rows: Record<string, unknown> = {}) {
  const events: string[] = [];
  const queries: { table: string; calls: [string, unknown[]][] }[] = [];
  const from = vi.fn((table: string) => {
    const calls: [string, unknown[]][] = [];
    queries.push({ table, calls });
    const query = {
      select: vi.fn((...args: unknown[]) => { calls.push(["select", args]); return query; }),
      order: vi.fn((...args: unknown[]) => { calls.push(["order", args]); return query; }),
      limit: vi.fn((...args: unknown[]) => { calls.push(["limit", args]); return query; }),
      range: vi.fn((...args: unknown[]) => { calls.push(["range", args]); return query; }),
      gte: vi.fn((...args: unknown[]) => { calls.push(["gte", args]); return query; }),
      lt: vi.fn((...args: unknown[]) => { calls.push(["lt", args]); return query; }),
      is: vi.fn((...args: unknown[]) => { calls.push(["is", args]); return query; }),
      not: vi.fn((...args: unknown[]) => { calls.push(["not", args]); return query; }),
      eq: vi.fn((...args: unknown[]) => { calls.push(["eq", args]); return query; }),
      in: vi.fn((...args: unknown[]) => { calls.push(["in", args]); return query; }),
      or: vi.fn((...args: unknown[]) => { calls.push(["or", args]); return query; }),
      maybeSingle: vi.fn(() => Promise.resolve({ data: rows[table] ?? null, error: null })),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(rows.rangeError && Number(calls.filter(([method]) => method === "range").at(-1)?.[1][0]) > 0
        ? { data: null, error: { code: "PGRST103" }, count: null }
        : { data: rows[table] ?? [], error: null, count: rows.total ?? (Array.isArray(rows[table]) ? rows[table].length : 0) }).then(resolve),
    };
    return query;
  });
  const upload = vi.fn(async () => { events.push("upload"); return { error: null }; });
  const remove = vi.fn(async (paths: string[]) => { events.push("remove"); return { data: paths.map((name) => ({ name })), error: null as null | { message: string } }; });
  const rpc = vi.fn(async () => { events.push("rpc"); return { data: { review_id: id, villa_id: "9", removed_storage_paths: [image.storage_path], images: [] }, error: null as null | { code: string; message: string; details?: string; hint?: string }, status: 200 }; });
  const storage = { upload, remove, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.test/storage/v1/object/public/villa-reviews/${path}` } }) };
  mocks.client.mockReturnValue({ from, rpc, storage: { from: vi.fn(() => storage) } });
  mocks.titles.mockResolvedValue(new Map([["9", "บ้านสายลม"]]));
  mocks.revalidate.mockImplementation(async () => { events.push("revalidate"); });
  return { from, queries, upload, remove, rpc, events };
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("private admin review reads", () => {
  it("pages server-side with the exact filtered count and Bangkok day boundaries", async () => {
    const state = setup({ villa_reviews: [{ ...base, villa_review_images: [{ id: imageId }, { id: editorId }] }], total: 12482 });
    const result = await listAdminVillaReviews({ page: 8, pageSize: 6, villaId: "9", dateFrom: "2026-09-01", dateTo: "2026-09-07", hasImages: true, sort: "highest" });
    expect(result).toMatchObject({ total: 12482, page: 8, pageSize: 6, items: [{ imageCount: 2 }] });
    expect(state.queries[0].calls).toEqual(expect.arrayContaining([
      ["range", [42, 47]], ["eq", ["villa_id", "9"]],
      ["gte", ["created_at", "2026-09-01T00:00:00+07:00"]],
      ["lt", ["created_at", "2026-09-07T17:00:00.000Z"]],
      ["not", ["villa_review_images", "is", null]],
      ["order", ["rating", { ascending: false }]],
    ]));
  });

  it("keeps total metadata on an empty page and filters reviews without images", async () => {
    const state = setup({ total: 10 });
    expect(await listAdminVillaReviews({ page: 2, hasImages: false, sort: "oldest" })).toMatchObject({ items: [], total: 10, page: 2, pageSize: 6 });
    expect(state.queries[0].calls).toContainEqual(["is", ["villa_review_images", null]]);
    expect(state.queries[0].calls).toContainEqual(["order", ["created_at", { ascending: true }]]);
  });

  it("recovers an out-of-range database page after reviews were deleted without resetting URL state", async () => {
    const state = setup({ total: 10, rangeError: true, villa_reviews: [base] });
    expect(await listAdminVillaReviews({ page: 8 })).toEqual({ items: [], total: 10, page: 8, pageSize: 6 });
    expect(state.queries[0].calls).toContainEqual(["range", [0, 0]]);
    expect(mocks.titles).not.toHaveBeenCalled();
  });

  it("searches UUID and review text and orders lowest ratings before newest ties", async () => {
    const state = setup();
    await listAdminVillaReviews({ search: id, sort: "lowest" });
    const filter = state.queries[0].calls.find(([method]) => method === "or")?.[1][0];
    expect(filter).toContain(`id.eq.${id}`);
    expect(filter).toContain(`comment.ilike."%${id}%"`);
    expect(state.queries[0].calls.filter(([method]) => method === "order")).toEqual([
      ["order", ["rating", { ascending: true }]], ["order", ["created_at", { ascending: false }]], ["order", ["id", { ascending: false }]],
    ]);
  });

  it.each(["DV-9", "dv9", "9", "dv-9"])("matches villa number 9 when searching %s", async (search) => {
    const state = setup();
    await listAdminVillaReviews({ search });
    expect(state.queries[0].calls.find(([method]) => method === "or")?.[1][0]).toContain('villa_id.eq."9"');
  });

  it("rejects invalid dates, sort and unsafe pagination before reading reviews", async () => {
    const state = setup();
    for (const query of [{ page: 0 }, { page: 1.5 }, { page: Number.MAX_SAFE_INTEGER }, { pageSize: 7 }, { sort: "invalid" }, { hasImages: "yes" }, { dateFrom: "2026-02-30" }, { dateFrom: "2026-09-08", dateTo: "2026-09-07" }]) {
      await expect(listAdminVillaReviews(query as Parameters<typeof listAdminVillaReviews>[0])).rejects.toMatchObject({ code: "validation_error", status: 400 });
    }
    expect(state.from).not.toHaveBeenCalled();
  });
  it("projects a bounded private list without full phone or booking code", async () => {
    const state = setup({ villa_reviews: [{ ...base, phone_e164: "+66812345678", booking_code: "SECRET", villa_review_images: [{ id: imageId, public_url: image.public_url, display_order: 1 }] }] });
    const result = await listAdminVillaReviews({ search: "081", rating: 5 });
    expect(result).toEqual({ items: [{ id, villaId: "9", villaTitle: "บ้านสายลม", rating: 5, commentExcerpt: "สะอาดมาก", maskedPhone: "xxx-xxxx-5678", imageCount: 1, reviewImageUrl: image.public_url, createdAt: base.created_at, updatedAt: base.updated_at }], total: 1, page: 1, pageSize: 6 });
    expect(JSON.stringify(result)).not.toMatch(/SECRET|66812345678|storage_path/);
    expect(state.queries.map((query) => query.table)).toEqual(["villa_reviews"]);
    expect(state.queries[0].calls).toEqual(expect.arrayContaining([["range", [0, 5]], ["eq", ["rating", 5]]]));
    expect(state.queries[0].calls[0]).toEqual(["select", ["id,villa_id,rating,comment,masked_phone,created_at,updated_at,villa_review_images(id,public_url,display_order)", { count: "exact" }]]);
    expect(state.queries[0].calls.find(([method]) => method === "or")?.[1][0]).toContain("phone_e164.ilike.");
    expect(mocks.titles).toHaveBeenCalledExactlyOnceWith(["9"]);
  });

  it("caps returned rows and falls back if catalog fails", async () => {
    const rows = Array.from({ length: 26 }, (_, index) => ({ ...base, id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}` }));
    const state = setup({ villa_reviews: rows });
    mocks.titles.mockRejectedValue(new Error("catalog offline"));
    const result = await listAdminVillaReviews({});
    expect(result.items).toHaveLength(6);
    expect(result.items[0].villaTitle).toBe("พูลวิลล่า 9");
    expect(result.total).toBe(26);
    expect(state.queries[0].calls).toContainEqual(["order", ["id", { ascending: false }]]);
  });

  it("rejects out-of-range query values before private reads", async () => {
    const state = setup();
    for (const query of [{ search: "x".repeat(101) }, { rating: 0 }, { pageSize: 7 }]) {
      await expect(listAdminVillaReviews(query)).rejects.toMatchObject({ code: "validation_error", status: 400 });
    }
    expect(state.from).not.toHaveBeenCalled();
  });

  it("searches a full Thai local phone using its stored international form", async () => {
    const state = setup();
    await listAdminVillaReviews({ search: "0812345678" });
    expect(state.queries[0].calls.find(([method]) => method === "or")?.[1][0]).toContain('phone_e164.ilike."%+66812345678%"');
  });

  it("quotes search operators", async () => {
    const state = setup();
    await listAdminVillaReviews({ search: 'BOOK\",rating.eq.1)' });
    expect(state.queries[0].calls.find(([method]) => method === "or")?.[1][0]).toContain('booking_code.ilike."%BOOK\\\",rating.eq.1)%"');
  });

  it("preserves literal booking-code underscores and uses exact search for a literal asterisk", async () => {
    const state = setup();
    await listAdminVillaReviews({ search: "BOOK_1" });
    expect(state.queries[0].calls.find(([method]) => method === "or")?.[1][0]).toContain('booking_code.ilike."%BOOK\\\\_1%"');
    await listAdminVillaReviews({ search: "BOOK*1" });
    expect(state.queries[1].calls.find(([method]) => method === "or")?.[1][0]).toContain('booking_code.eq."BOOK*1"');
  });

  it("returns full private detail with ordered images and chronological audit queries", async () => {
    const log = { id: editorId, review_id: id, before_snapshot: { rating: 3 }, after_snapshot: { rating: 5 }, created_at: base.updated_at };
    const state = setup({ villa_reviews: { ...base, phone_e164: "+66812345678", booking_code: "BOOK-1" }, villa_review_images: [image], villa_review_edit_logs: [log] });
    const result = await getAdminVillaReviewDetail(id);
    expect(result).toMatchObject({ phoneE164: "+66812345678", bookingCode: "BOOK-1", images: [{ id: imageId, url: image.public_url, displayOrder: 1 }], editLogs: [{ id: editorId, reviewId: id, beforeSnapshot: { rating: 3 }, afterSnapshot: { rating: 5 }, createdAt: base.updated_at }] });
    expect(state.queries.find((query) => query.table === "villa_review_images")?.calls).toContainEqual(["order", ["display_order", { ascending: true }]]);
    expect(state.queries.find((query) => query.table === "villa_review_edit_logs")?.calls).toContainEqual(["order", ["created_at", { ascending: true }]]);
  });

  it("returns null for a missing base review without reading ancillary private data", async () => {
    const state = setup();
    await expect(getAdminVillaReviewDetail(id)).resolves.toBeNull();
    expect(state.from).toHaveBeenCalledExactlyOnceWith("villa_reviews");
  });
});

describe("admin review mutation transactions", () => {
  it("validates before uploads and only passes normalized editable fields and trusted editor to RPC", async () => {
    const state = setup();
    await expect(updateAdminVillaReview({ id, editorId, input: { ...input, rating: 9 }, files: [file] })).rejects.toMatchObject({ code: "validation_error", fieldErrors: { rating: expect.any(String) } });
    await expect(updateAdminVillaReview({ id, editorId, input, files: [{ ...file, size: 6 * 1024 * 1024 } as File] })).rejects.toMatchObject({ code: "validation_error", fieldErrors: { "images.0": expect.any(String) } });
    expect(state.upload).not.toHaveBeenCalled();
    const result = await updateAdminVillaReview({ id, editorId, input: { ...input, editorId: "spoofed", bookingCode: "spoofed" }, files: [file] });
    expect(result).toMatchObject({ ok: true });
    expect(state.events).toEqual(["upload", "rpc", "remove", "revalidate"]);
    expect(state.rpc).toHaveBeenCalledWith("update_villa_review_admin", { p_review_id: id, p_editor_id: editorId, p_rating: 4, p_comment: "สะอาด", p_retained_image_ids: [imageId], p_new_images: [{ storage_path: expect.stringMatching(/^villa-reviews\/[0-9a-f-]+\/[0-9a-f-]+\.jpg$/), public_url: expect.stringContaining("/storage/v1/object/public/villa-reviews/") }] });
    expect(state.from).not.toHaveBeenCalled();
    expect(state.remove).toHaveBeenCalledExactlyOnceWith([image.storage_path]);
    expect(mocks.revalidate).toHaveBeenCalledExactlyOnceWith("9");
  });

  it("removes only fresh uploads after a confirmed RPC rejection and sanitizes database errors", async () => {
    const state = setup();
    state.rpc.mockResolvedValue({ data: null!, status: 400, error: { code: "22023", message: "Invalid retained review image IDs", details: "SECRET details", hint: "SECRET hint" } });
    await expect(updateAdminVillaReview({ id, editorId, input, files: [file] })).rejects.toMatchObject({ code: "validation_error", status: 400, supabaseCode: "22023", details: null, hint: null });
    const paths = state.remove.mock.calls[0][0];
    expect(paths).toHaveLength(1);
    expect(paths).not.toContain(image.storage_path);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("keeps uploads when RPC transport failure leaves the commit outcome unknown", async () => {
    const state = setup();
    state.rpc.mockRejectedValue(new Error("connection lost SECRET"));
    await expect(updateAdminVillaReview({ id, editorId, input, files: [file] })).rejects.toMatchObject({ code: "mutation_outcome_unknown" });
    expect(state.remove).not.toHaveBeenCalled();
  });

  it("keeps a successful save successful and revalidates when old cleanup fails", async () => {
    const state = setup();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    state.remove.mockResolvedValue({ data: [], error: { message: "SECRET storage problem" } });
    await expect(updateAdminVillaReview({ id, editorId, input, files: [file] })).resolves.toMatchObject({ ok: true });
    expect(state.remove).toHaveBeenCalledExactlyOnceWith([image.storage_path]);
    expect(mocks.revalidate).toHaveBeenCalledWith("9");
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain("SECRET");
  });

  it("deletes through RPC before storage and revalidates even when cleanup throws", async () => {
    const state = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.remove.mockImplementation(async () => { state.events.push("remove"); throw new Error("offline"); });
    await expect(deleteAdminVillaReview({ id, editorId })).resolves.toMatchObject({ ok: true });
    expect(state.events).toEqual(["rpc", "remove", "revalidate"]);
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith("delete_villa_review_admin", { p_review_id: id, p_editor_id: editorId });
    expect(state.from).not.toHaveBeenCalled();
  });

  it("maps missing delete to 404 without cleanup or invalidation", async () => {
    const state = setup();
    state.rpc.mockResolvedValue({ data: null!, status: 400, error: { code: "P0002", message: "Villa review not found" } });
    await expect(deleteAdminVillaReview({ id, editorId })).rejects.toMatchObject({ code: "not_found", status: 404, supabaseCode: "P0002" });
    expect(state.remove).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("accepts case-insensitive UUID input while checking the canonical RPC response", async () => {
    const state = setup();
    const canonicalId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    state.rpc.mockResolvedValue({ data: { review_id: canonicalId, villa_id: "9", removed_storage_paths: [], images: [] }, error: null, status: 200 });
    await expect(deleteAdminVillaReview({ id: canonicalId.toUpperCase(), editorId })).resolves.toMatchObject({ ok: true, reviewId: canonicalId });
  });

  it("cleans previous uploads after a later upload failure without calling RPC", async () => {
    const state = setup();
    state.upload.mockRejectedValueOnce(new Error("upload failed"));
    await expect(updateAdminVillaReview({ id, editorId, input, files: [file] })).rejects.toMatchObject({ code: "storage_error" });
    expect(state.remove).not.toHaveBeenCalled();
    state.upload.mockResolvedValueOnce({ error: null }).mockRejectedValueOnce(new Error("second upload failed"));
    await expect(updateAdminVillaReview({ id, editorId, input, files: [file, file] })).rejects.toMatchObject({ code: "storage_error" });
    expect(state.remove.mock.calls[0][0]).toHaveLength(1);
    expect(state.remove.mock.calls[0][0]).not.toContain(image.storage_path);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it.each([502, 200])("retains uploads for an undecodable RPC outcome with status %i", async (status) => {
    const state = setup();
    state.rpc.mockResolvedValue({ data: null!, error: null, status });
    await expect(updateAdminVillaReview({ id, editorId, input, files: [file] })).rejects.toMatchObject({ code: "mutation_outcome_unknown" });
    expect(state.remove).not.toHaveBeenCalled();
  });

  it("does not roll back storage or report a committed edit failed when revalidation fails", async () => {
    const state = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.revalidate.mockRejectedValue(new Error("cache unavailable"));
    await expect(updateAdminVillaReview({ id, editorId, input, files: [file] })).resolves.toMatchObject({ ok: true });
    expect(state.remove).toHaveBeenCalledExactlyOnceWith([image.storage_path]);
  });
});
