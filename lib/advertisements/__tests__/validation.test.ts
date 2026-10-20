import { describe, expect, it } from "vitest";
import {
  parseAdvertisementDraft,
  parseAdvertisementCursor,
  validateAdvertisementUpload,
} from "../validation";
const id = "10000000-0000-4000-8000-000000000001";
const draft = {
  id,
  title: " กิจกรรม ",
  zone: "all",
  isActive: true,
  updatedAt: null,
  images: [{ uploadIndex: 0 }],
};
describe("advertisement draft validation", () => {
  it("accepts automatic ranks beyond the former manual limit but rejects out-of-range or injected cursors", () => {
    for (const order of [0, 9999, 10000, 2147483647]) {
      expect(parseAdvertisementCursor(`${order}:${id}`)).toEqual({ order, id });
    }
    for (const order of ["2147483648", "-1", "01", "1e4", "1,or(id.eq.bad)", "99999999999999999999999999"]) {
      expect(parseAdvertisementCursor(`${order}:${id}`)).toBeNull();
    }
  });
  it("normalizes title and accepts explicitly ordered uploads", () => {
    expect(parseAdvertisementDraft(draft).draft?.title).toBe("กิจกรรม");
  });
  it("leaves advertisement ordering to the database and ignores legacy client ranks", () => {
    expect(parseAdvertisementDraft(draft).errors).toEqual([]);
    const result = parseAdvertisementDraft({ ...draft, sortOrder: -1 });
    expect(result.errors).toEqual([]);
    expect(result.draft).not.toHaveProperty("sortOrder");
  });
  it.each([
    { title: " " },
    { zone: "unknown" },
    { isActive: "true" },
    { images: [] },
    { images: [{ uploadIndex: 0 }, { uploadIndex: 0 }] },
    { images: [{ id: "../bad" }] },
    { updatedAt: "garbage" },
  ])("rejects malformed input %j", (change) => {
    expect(
      parseAdvertisementDraft({ ...draft, ...change }).errors.length,
    ).toBeGreaterThan(0);
  });
  it("accepts two images", () => {
    expect(parseAdvertisementDraft({ ...draft, images: [{ uploadIndex: 0 }, { uploadIndex: 1 }] }).errors).toEqual([]);
  });
  it("rejects three images", () =>
    expect(
      parseAdvertisementDraft({
        ...draft,
        images: Array.from({ length: 3 }, (_, uploadIndex) => ({
          uploadIndex,
        })),
      }).draft,
    ).toBeNull());
  it("validates both MIME and extension, and rejects oversize uploads", () => {
    expect(
      validateAdvertisementUpload({
        type: "image/png",
        name: "a.png",
        size: 100,
      }),
    ).toEqual([]);
    expect(
      validateAdvertisementUpload({
        type: "image/png",
        name: "a.exe",
        size: 100,
      }).length,
    ).toBeGreaterThan(0);
    expect(
      validateAdvertisementUpload({
        type: "image/svg+xml",
        name: "a.svg",
        size: 100,
      }).length,
    ).toBeGreaterThan(0);
    expect(
      validateAdvertisementUpload({
        type: "image/png",
        name: "a.png",
        size: 7 * 1024 * 1024,
      }).length,
    ).toBeGreaterThan(0);
  });
});
