import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import { AdminVillaReviewError, getAdminVillaReviewDetail } from "@/lib/villa-reviews/admin";
import * as route from "../route";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), remove: vi.fn(), storage: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/route-helpers", () => ({ requireHomeConfigAdmin: vi.fn() }));
vi.mock("@/lib/cache-revalidation", () => ({ revalidateVillaReviewsCache: vi.fn() }));
vi.mock("@/lib/villas/server", () => ({ fetchVillaTitlesByIds: vi.fn() }));
vi.mock("@/lib/villa-reviews/supabase", () => ({ createVillaReviewsClient: () => ({ rpc: mocks.rpc, storage: { from: mocks.storage } }) }));
vi.mock("@/lib/villa-reviews/admin", async (original) => ({
  ...await original<typeof import("@/lib/villa-reviews/admin")>(), getAdminVillaReviewDetail: vi.fn(),
}));

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const editorId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const context = (value = id) => ({ params: Promise.resolve({ id: value }) });
function patchForm() {
  const form = new FormData();
  form.set("rating", "4"); form.set("comment", "สะอาดและสะดวก"); form.set("retainedImageIds", "[]");
  return form;
}
const request = (form = patchForm()) => new Request(`https://test.local/api/admin/villa-reviews/${id}`, { method: "PATCH", body: form });

describe("admin review detail route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireHomeConfigAdmin).mockResolvedValue({ ok: true, userId: editorId, supabase: {} } as Awaited<ReturnType<typeof requireHomeConfigAdmin>>);
    mocks.rpc.mockResolvedValue({ status: 200, data: { review_id: id, villa_id: "DV01", removed_storage_paths: [] }, error: null });
    mocks.upload.mockResolvedValue({ error: null });
    mocks.storage.mockReturnValue({ upload: mocks.upload, remove: mocks.remove, getPublicUrl: () => ({ data: { publicUrl: "https://test.local/review.jpg" } }) });
    vi.mocked(getAdminVillaReviewDetail).mockResolvedValue(null);
  });

  it.each(["GET", "PATCH", "DELETE"] as const)("passes through %s auth failure before private work", async (method) => {
    const denied = Response.json({ error: "denied" }, { status: 403 });
    vi.mocked(requireHomeConfigAdmin).mockResolvedValue({ ok: false, response: denied });
    expect(await route[method](request(), context())).toBe(denied);
    expect(getAdminVillaReviewDetail).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["GET", "PATCH", "DELETE"] as const)("rejects invalid UUID for %s before service work", async (method) => {
    expect((await route[method](request(), context("not-a-uuid"))).status).toBe(404);
    expect(getAdminVillaReviewDetail).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns 404 when detail is missing", async () => {
    expect((await route.GET(request(), context())).status).toBe(404);
  });

  it("returns authenticated private detail and forbids caching", async () => {
    vi.mocked(getAdminVillaReviewDetail).mockResolvedValue({
      id, villaId: "DV01", villaTitle: "บ้านพัก DV01", rating: 4,
      comment: "สะอาดและสะดวก", commentExcerpt: "สะอาดและสะดวก", maskedPhone: "xxx-xxxx-5678",
      imageCount: 0, createdAt: "2026-09-07T00:00:00Z", updatedAt: "2026-09-07T00:00:00Z",
      phoneE164: "+66812345678", bookingCode: "BOOK1", editLogs: [], images: [],
    });
    const response = await route.GET(request(), context());
    expect(await response.json()).toMatchObject({ id, phoneE164: "+66812345678", bookingCode: "BOOK1" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it.each([
    ["rating", ""], ["rating", "5.0"], ["rating", "6"], ["comment", "a".repeat(1001)],
    ["comment", "fuck"], ["retainedImageIds", "[bad"], ["retainedImageIds", "null"],
    ["retainedImageIds", JSON.stringify([id, id])], ["retainedImageIds", "x".repeat(1025)],
  ])("returns field errors for invalid %s content", async (field, value) => {
    const form = patchForm(); form.set(field, value);
    const response = await route.PATCH(request(form), context());
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.any(String), fieldErrors: expect.any(Object) });
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.upload).not.toHaveBeenCalled();
  });

  it.each(["duplicate", "file-string", "image-string", "unknown", "missing"])("rejects malformed form shape: %s", async (kind) => {
    const form = patchForm();
    if (kind === "duplicate") form.append("rating", "3");
    if (kind === "file-string") form.set("comment", new File(["bad"], "x.txt"));
    if (kind === "image-string") form.append("images", "image.jpg");
    if (kind === "unknown") form.append("editorId", id);
    if (kind === "missing") form.delete("retainedImageIds");
    expect((await route.PATCH(request(form), context())).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["count", "type", "size"])("uses real service image validation for %s", async (kind) => {
    const form = patchForm();
    for (let index = 0; index < (kind === "count" ? 6 : 1); index++) {
      form.append("images", new File([kind === "size" ? new Uint8Array(5 * 1024 * 1024 + 1) : "data"], kind === "type" ? "file.txt" : "file.jpg", { type: kind === "type" ? "text/plain" : "image/jpeg" }));
    }
    const response = await route.PATCH(request(form), context());
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ fieldErrors: expect.any(Object) });
    expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed multipart instead of 500", async () => {
    const response = await route.PATCH(new Request("https://test.local", { method: "PATCH", headers: { "Content-Type": "multipart/form-data; boundary=missing" }, body: "broken" }), context());
    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("fieldErrors");
  });

  it("bounds the streamed request even without content length", async () => {
    const bytes = new Uint8Array(26 * 1024 * 1024);
    bytes.set(new TextEncoder().encode('--test\r\nContent-Disposition: form-data; name="images"; filename="large.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'));
    const end = new TextEncoder().encode("\r\n--test--\r\n"); bytes.set(end, bytes.length - end.length);
    const response = await route.PATCH(new Request("https://test.local", {
      method: "PATCH", headers: { "Content-Type": "multipart/form-data; boundary=test" },
      body: bytes,
    }), context());
    expect(response.status).toBe(400); expect(mocks.upload).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ fieldErrors: { images: expect.any(String) } });
  });

  it("passes an actual File and trusted editor identity to persistence", async () => {
    const form = patchForm(); form.append("images", new File(["image"], "image.jpg", { type: "image/jpeg" }));
    const response = await route.PATCH(request(form), context());
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ ok: true });
    expect(mocks.upload.mock.calls[0][1]).toBeInstanceOf(File);
    expect(mocks.rpc).toHaveBeenCalledWith("update_villa_review_admin", expect.objectContaining({ p_review_id: id, p_editor_id: editorId, p_rating: 4, p_comment: "สะอาดและสะดวก", p_retained_image_ids: [] }));
  });

  it("deletes with auth identity", async () => {
    const response = await route.DELETE(request(), context());
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("delete_villa_review_admin", { p_review_id: id, p_editor_id: editorId });
  });

  it.each(["PATCH", "DELETE"] as const)("maps %s missing record to 404", async (method) => {
    mocks.rpc.mockResolvedValue({ status: 400, error: { code: "P0002" } });
    expect((await route[method](request(), context())).status).toBe(404);
  });

  it("serializes safe database metadata without private error text", async () => {
    mocks.rpc.mockResolvedValue({ status: 500, error: { code: "42501", message: "secret phone", details: "private row", hint: "private hint" } });
    const response = await route.DELETE(request(), context());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: "database_error", supabaseCode: "42501", message: expect.any(String), details: null, hint: null });
  });

  it("preserves unknown mutation outcome as 503", async () => {
    mocks.rpc.mockRejectedValue(new Error("network timeout"));
    const response = await route.DELETE(request(), context());
    expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ code: "mutation_outcome_unknown" });
  });

  it("maps unexpected detail errors safely and preserves typed errors", async () => {
    vi.mocked(getAdminVillaReviewDetail).mockRejectedValueOnce(new Error("secret details"));
    const response = await route.GET(request(), context());
    expect(response.status).toBe(500); expect(await response.text()).not.toContain("secret details");
    vi.mocked(getAdminVillaReviewDetail).mockRejectedValueOnce(new AdminVillaReviewError("database_error", "อ่านข้อมูลไม่สำเร็จ", 500, {}, "42501"));
    expect(await (await route.GET(request(), context())).json()).toMatchObject({ supabaseCode: "42501" });
  });
});
