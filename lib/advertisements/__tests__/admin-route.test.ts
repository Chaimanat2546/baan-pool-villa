import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  saveAdminAdvertisement,
  deleteAdminAdvertisement,
  listAdminAdvertisements,
} from "../admin-route";
import {
  cleanupAdvertisementAssets,
  uploadAdvertisementAssets,
} from "../admin-assets";
import { revalidateAdvertisementsCache } from "@/lib/cache-revalidation";
vi.mock("server-only", () => ({}));
vi.mock("../admin-assets", () => ({
  cleanupAdvertisementAssets: vi.fn(async () => []),
  uploadAdvertisementAssets: vi.fn(),
}));
vi.mock("@/lib/cache-revalidation", () => ({
  revalidateAdvertisementsCache: vi.fn(),
}));
const id = "10000000-0000-4000-8000-000000000001",
  imageId = "20000000-0000-4000-8000-000000000001";
const image = { id: imageId, storagePath: `${id}/${imageId}.webp` };
const draft = {
  id,
  title: "กิจกรรม",
  zone: "all",
  isActive: true,
  updatedAt: null,
  images: [{ uploadIndex: 0 }],
};
function request(value: unknown = draft, files = true) {
  const form = new FormData();
  form.set("advertisement", JSON.stringify(value));
  if (files)
    form.append("images", new File(["png"], "a.png", { type: "image/png" }));
  return new Request("https://example.com/api/admin/advertisements", {
    method: "POST",
    body: form,
  });
}
const rpc = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(uploadAdvertisementAssets).mockResolvedValue({
    assets: [image],
    response: null,
  });
});

describe("advertisement list queries", () => {
  function client() {
    const query = { select: vi.fn(), order: vi.fn(), eq: vi.fn(), ilike: vi.fn(), range: vi.fn() };
    for (const fn of [query.select, query.order, query.eq, query.ilike]) fn.mockReturnValue(query);
    query.range.mockResolvedValue({ data: [], count: 17, error: null });
    const from = vi.fn(() => query);
    return { query, from };
  }
  it("pages eight records and applies literal title, zone and status filters before paging", async () => {
    const { query, from } = client();
    const params = new URLSearchParams({ page: "2", search: " เรือ_50% ", zone: "pattaya", status: "inactive" });
    const response = await listAdminAdvertisements(new Request(`https://example.com/?${params}`), { from } as never);
    expect(response.status).toBe(200);
    expect(query.range).toHaveBeenCalledWith(8, 15);
    expect(query.eq).toHaveBeenCalledWith("zone", "pattaya");
    expect(query.eq).toHaveBeenCalledWith("is_active", false);
    expect(query.ilike).toHaveBeenCalledWith("title", "%เรือ\\_50\\%%");
    expect(await response.json()).toMatchObject({ page: 2, pageSize: 8, total: 17 });
  });
  it.each(["page=0", "status=bad", "zone=bad", `search=${"a".repeat(161)}`])("rejects invalid filters before querying: %s", async params => {
    const { from } = client();
    const response = await listAdminAdvertisements(new Request(`https://example.com/?${params}`), { from } as never);
    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
});
describe("site advertisement persistence", () => {
  it("rejects a third image before uploading or calling the database", async () => {
    const response = await saveAdminAdvertisement(request({ ...draft, images: [0, 1, 2].map(uploadIndex => ({ uploadIndex })) }), { rpc } as never);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ errors: expect.arrayContaining(["กรุณาเลือกรูป 1–2 รูป"]) });
    expect(uploadAdvertisementAssets).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects malformed draft before uploads or database calls", async () => {
    expect(
      (
        await saveAdminAdvertisement(request({ ...draft, zone: "oops" }), {
          rpc,
        } as never)
      ).status,
    ).toBe(400);
    expect(uploadAdvertisementAssets).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects missing file references", async () => {
    expect(
      (await saveAdminAdvertisement(request(draft, false), { rpc } as never))
        .status,
    ).toBe(400);
    expect(uploadAdvertisementAssets).not.toHaveBeenCalled();
  });
  it("persists an ordered snapshot and invalidates only after success", async () => {
    rpc.mockResolvedValue({
      data: { id, updatedAt: "2026-10-20T12:00:00Z", removedPaths: [] },
      error: null,
    });
    expect(
      (await saveAdminAdvertisement(request(), { rpc } as never)).status,
    ).toBe(200);
    expect(rpc).toHaveBeenCalledWith("save_site_advertisement", {
      p_ad: draft,
      p_images: [image],
    });
    expect(revalidateAdvertisementsCache).toHaveBeenCalledOnce();
  });
  it("does not forward client-provided advertisement ranks to persistence", async () => {
    rpc.mockResolvedValue({ data: { id, updatedAt: "2026-10-20T12:00:00Z", removedPaths: [] }, error: null });
    const response = await saveAdminAdvertisement(request({ ...draft, sortOrder: 9999 }), { rpc } as never);
    expect(response.status).toBe(200);
    expect(rpc.mock.calls[0][1].p_ad).not.toHaveProperty("sortOrder");
  });
  it("reports conflicts and cleans only uploads rejected by the transaction", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "40001", message: "changed" },
    });
    expect(
      (await saveAdminAdvertisement(request(), { rpc } as never)).status,
    ).toBe(409);
    expect(cleanupAdvertisementAssets).toHaveBeenCalledWith(expect.anything(), [
      image.storagePath,
    ]);
    expect(revalidateAdvertisementsCache).not.toHaveBeenCalled();
  });
  it("retains uploaded files if a network failure leaves the commit uncertain", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Failed to fetch" },
    });
    expect(
      (await saveAdminAdvertisement(request(), { rpc } as never)).status,
    ).toBeGreaterThanOrEqual(400);
    expect(cleanupAdvertisementAssets).not.toHaveBeenCalled();
  });
  it("does not delete files after a conflicting delete", async () => {
    rpc.mockResolvedValue({
      error: { code: "40001", message: "changed" },
      data: null,
    });
    const req = new Request("https://example.com/api/admin/advertisements", {
      method: "DELETE",
      body: JSON.stringify({ id, updatedAt: "2026-10-20T12:00:00Z" }),
    });
    expect((await deleteAdminAdvertisement(req, { rpc } as never)).status).toBe(
      409,
    );
    expect(cleanupAdvertisementAssets).not.toHaveBeenCalled();
  });
});
