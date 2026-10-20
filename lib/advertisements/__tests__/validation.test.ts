import { describe, expect, it } from "vitest";
import {
  parseAdvertisementDraft,
  validateAdvertisementUpload,
} from "../validation";
const id = "10000000-0000-4000-8000-000000000001";
const draft = {
  id,
  title: " กิจกรรม ",
  zone: "all",
  isActive: true,
  sortOrder: 0,
  updatedAt: null,
  images: [{ uploadIndex: 0 }],
};
describe("advertisement draft validation", () => {
  it("normalizes title and accepts explicitly ordered uploads", () => {
    expect(parseAdvertisementDraft(draft).draft?.title).toBe("กิจกรรม");
  });
  it.each([
    { title: " " },
    { zone: "unknown" },
    { sortOrder: -1 },
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
  it("bounds image count", () =>
    expect(
      parseAdvertisementDraft({
        ...draft,
        images: Array.from({ length: 13 }, (_, uploadIndex) => ({
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
