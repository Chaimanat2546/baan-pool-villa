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
  rpc.mockReset();
  vi.mocked(uploadAdvertisementAssets).mockResolvedValue({
    assets: [image],
    response: null,
  });
});

describe("advertisement list queries", () => {
  it("passes validated filters to the admin-only database page RPC", async () => {
    rpc.mockResolvedValue({ data: { advertisements: [], total: 17 }, error: null });
    const params = new URLSearchParams({ page: "2", search: " เรือ_50% ", zone: "pattaya", status: "inactive" });
    const response = await listAdminAdvertisements(new Request(`https://example.com/?${params}`), { rpc } as never);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("list_site_advertisements", { p_page: 2, p_search: "เรือ_50%", p_zone: "pattaya", p_status: "inactive" });
    expect(await response.json()).toMatchObject({ page: 2, pageSize: 8, total: 17 });
  });
  it("maps RPC image snapshots to the existing editor response", async () => {
    rpc.mockResolvedValue({ data: { total: 1, advertisements: [{ id, title: "เรือ", zone: "all", is_active: true, sort_order: 4, updated_at: "2026-10-20T12:00:00Z", site_advertisement_images: [{ id: imageId, storage_path: image.storagePath, display_order: 0 }] }] }, error: null });
    const getPublicUrl = vi.fn(() => ({ data: { publicUrl: "https://example.com/image.webp" } }));
    const response = await listAdminAdvertisements(new Request("https://example.com/"), { rpc, storage: { from: () => ({ getPublicUrl }) } } as never);
    expect(await response.json()).toMatchObject({ total: 1, advertisements: [{ id, sortOrder: 4, isActive: true, images: [{ id: imageId, storagePath: image.storagePath, url: "https://example.com/image.webp" }] }] });
  });
  it.each(["page=0", "status=bad", "zone=bad", `search=${"a".repeat(161)}`])("rejects invalid filters before querying: %s", async params => {
    const response = await listAdminAdvertisements(new Request(`https://example.com/?${params}`), { rpc } as never);
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("surfaces RPC errors and rejects a malformed page response", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "Admin access required" } });
    const response = await listAdminAdvertisements(new Request("https://example.com/"), { rpc } as never);
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await response.json()).toMatchObject({ code: "42501" });
    rpc.mockResolvedValueOnce({ data: { advertisements: [], total: -1 }, error: null });
    expect((await listAdminAdvertisements(new Request("https://example.com/"), { rpc } as never)).status).toBe(503);
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
