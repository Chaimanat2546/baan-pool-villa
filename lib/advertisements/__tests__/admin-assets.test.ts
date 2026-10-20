import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupAdvertisementAssets,
  uploadAdvertisementAssets,
} from "../admin-assets";
import { convertImageToWebp } from "@/lib/image-conversion";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/image-conversion", () => ({ convertImageToWebp: vi.fn() }));
const id = "10000000-0000-4000-8000-000000000001";
const imageId = "20000000-0000-4000-8000-000000000001";
const path = `${id}/${imageId}.webp`;
const upload = vi.fn(),
  remove = vi.fn(),
  insert = vi.fn(),
  update = vi.fn(),
  eq = vi.fn();
const supabase = {
  storage: { from: () => ({ upload, remove }) },
  from: vi.fn(() => ({ insert, update })),
};
const file = new File(["image"], "a.png", { type: "image/png" });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(convertImageToWebp).mockResolvedValue(
    new File(["webp"], "a.webp", { type: "image/webp" }),
  );
  upload.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  insert.mockResolvedValue({ error: null });
  update.mockReturnValue({ eq });
  eq.mockResolvedValue({ error: null });
});
describe("advertisement assets", () => {
  it("records every uploaded object before returning its reference", async () => {
    const result = await uploadAdvertisementAssets(supabase as never, id, [
      file,
    ]);
    expect(result.response).toBeNull();
    expect(result.assets).toHaveLength(1);
    expect(insert).toHaveBeenCalledWith({
      id: result.assets[0].id,
      storage_path: result.assets[0].storagePath,
    });
    expect(result.assets[0].storagePath).toMatch(
      new RegExp(`^${id}/[a-f0-9-]+\\.webp$`),
    );
  });
  it("cleans only its own preceding uploads when a later upload fails", async () => {
    upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({
        error: { message: "Storage failed", code: "storage_error" },
      });
    const result = await uploadAdvertisementAssets(supabase as never, id, [
      file,
      file,
    ]);
    expect(result.response?.status).toBeGreaterThanOrEqual(400);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
  });
  it("rolls back an object whose history could not be written", async () => {
    insert.mockResolvedValue({
      error: { message: "History denied", code: "42501" },
    });
    const result = await uploadAdvertisementAssets(supabase as never, id, [
      file,
    ]);
    expect(result.response?.status).toBeGreaterThanOrEqual(400);
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
  });
  it("rejects unreadable images before writing objects", async () => {
    vi.mocked(convertImageToWebp).mockRejectedValue(new Error("bad bytes"));
    expect(
      (await uploadAdvertisementAssets(supabase as never, id, [file])).response
        ?.status,
    ).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });
  it("does not mark history deleted when Storage cleanup fails", async () => {
    remove.mockResolvedValue({ error: { message: "failed" } });
    expect(
      (await cleanupAdvertisementAssets(supabase as never, [path])).length,
    ).toBeGreaterThan(0);
    expect(update).not.toHaveBeenCalled();
  });
  it("never passes unsafe cleanup paths to Storage", async () => {
    await cleanupAdvertisementAssets(supabase as never, [
      "../other/secret.webp",
    ]);
    expect(remove).not.toHaveBeenCalled();
  });
});
