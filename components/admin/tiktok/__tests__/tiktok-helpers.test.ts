import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "../../../../lib/site-settings/defaults";

import {
  buildTikTokFormData,
  getVisibleTikTokVideoCount,
  mapTikTokSettingsToDraft,
  shouldRedirectTikTokToLogin,
} from "../tiktok-helpers";

import {
  addTikTokVideoRow,
  deleteTikTokVideoRow,
  moveTikTokVideoRow,
} from "../tiktok-form";

describe("TikTok helper conversions and form data serialization", () => {
  it("maps all videos from site settings without truncating", () => {
    const draft = mapTikTokSettingsToDraft({
      ...DEFAULT_SITE_SETTINGS.tiktok,
      accountUrl: "https://www.tiktok.com/@baanpoolvilla",
      videos: [
        { url: "https://www.tiktok.com/@baanpoolvilla/video/1000000000000000001", videoId: "1", houseId: null },
        { url: "https://www.tiktok.com/@baanpoolvilla/video/1000000000000000002", videoId: "2", houseId: "501" },
      ],
    });

    expect(draft).toMatchObject({
      accountUrl: "https://www.tiktok.com/@baanpoolvilla",
      videos: [
        {
          houseId: null,
          url: "https://www.tiktok.com/@baanpoolvilla/video/1000000000000000001",
        },
        {
          houseId: "501",
          url: "https://www.tiktok.com/@baanpoolvilla/video/1000000000000000002",
        },
      ],
    });
    expect(draft.videos.map((video) => video.id)).toEqual([
      expect.stringContaining("tiktok-row-0"),
      expect.stringContaining("tiktok-row-1"),
    ]);
  });

  it("serializes all video urls into form data including beyond homepage limit", () => {
    const draft = {
      accountUrl: "https://www.tiktok.com/@baanpoolvilla",
      videos: [
        { id: "row-1", url: "https://www.tiktok.com/@a/video/1000000000000000001", houseId: "501", villaTitle: "Glass House B8" },
        { id: "row-2", url: "https://www.tiktok.com/@a/video/1000000000000000002", houseId: null, villaTitle: null },
        { id: "row-3", url: "https://www.tiktok.com/@a/video/1000000000000000003", houseId: null, villaTitle: null },
        { id: "row-4", url: "https://www.tiktok.com/@a/video/1000000000000000004", houseId: null, villaTitle: null },
        { id: "row-5", url: "https://www.tiktok.com/@a/video/1000000000000000005", houseId: null, villaTitle: null },
        { id: "row-6", url: "https://www.tiktok.com/@a/video/1000000000000000006", houseId: null, villaTitle: null },
        { id: "row-7", url: "https://www.tiktok.com/@a/video/1000000000000000007", houseId: null, villaTitle: null },
      ],
    };
    const formData = buildTikTokFormData(draft);

    expect(formData.get("tiktokAccountUrl")).toBe(draft.accountUrl);
    expect(JSON.parse(String(formData.get("tiktokVideoUrls")))).toEqual([
      { url: "https://www.tiktok.com/@a/video/1000000000000000001", houseId: "501" },
      { url: "https://www.tiktok.com/@a/video/1000000000000000002", houseId: null },
      { url: "https://www.tiktok.com/@a/video/1000000000000000003", houseId: null },
      { url: "https://www.tiktok.com/@a/video/1000000000000000004", houseId: null },
      { url: "https://www.tiktok.com/@a/video/1000000000000000005", houseId: null },
      { url: "https://www.tiktok.com/@a/video/1000000000000000006", houseId: null },
      { url: "https://www.tiktok.com/@a/video/1000000000000000007", houseId: null },
    ]);
  });

  it("limits the admin homepage preview count to 15 videos", () => {
    expect(
      getVisibleTikTokVideoCount(
        Array.from({ length: 16 }, (_, index) => `https://www.tiktok.com/@a/video/${index + 1}`),
      ),
    ).toBe(15);
  });

  it("keeps URL and villa selections paired when adding, moving, and deleting rows", () => {
    const base = {
      accountUrl: "",
      videos: [
        { id: "row-1", url: "https://www.tiktok.com/@a/video/1", houseId: "501", villaTitle: "Glass House B8" },
        { id: "row-2", url: "https://www.tiktok.com/@a/video/2", houseId: "502", villaTitle: "Villa Port Sand" },
        { id: "row-3", url: "https://www.tiktok.com/@a/video/3", houseId: null, villaTitle: null },
      ],
    };

    const afterAdd = addTikTokVideoRow(base);
    const afterAddRowId = afterAdd.videos[3]?.id;
    expect(afterAdd.videos.slice(0, 3).map((video) => video.id)).toEqual(["row-1", "row-2", "row-3"]);
    expect(typeof afterAddRowId).toBe("string");
    expect(afterAddRowId?.length).toBeGreaterThan(0);
    expect(afterAdd.videos.map(({ url, houseId, villaTitle }) => ({ url, houseId, villaTitle }))).toEqual([
      { url: "https://www.tiktok.com/@a/video/1", houseId: "501", villaTitle: "Glass House B8" },
      { url: "https://www.tiktok.com/@a/video/2", houseId: "502", villaTitle: "Villa Port Sand" },
      { url: "https://www.tiktok.com/@a/video/3", houseId: null, villaTitle: null },
      { url: "", houseId: null, villaTitle: null },
    ]);

    const afterMove = moveTikTokVideoRow(base, 0, 1);
    expect(afterMove.videos).toEqual([
      { id: "row-2", url: "https://www.tiktok.com/@a/video/2", houseId: "502", villaTitle: "Villa Port Sand" },
      { id: "row-1", url: "https://www.tiktok.com/@a/video/1", houseId: "501", villaTitle: "Glass House B8" },
      { id: "row-3", url: "https://www.tiktok.com/@a/video/3", houseId: null, villaTitle: null },
    ]);

    const afterDelete = deleteTikTokVideoRow(afterAdd, 1);
    expect(afterDelete.videos).toEqual([
      { id: "row-1", url: "https://www.tiktok.com/@a/video/1", houseId: "501", villaTitle: "Glass House B8" },
      { id: "row-3", url: "https://www.tiktok.com/@a/video/3", houseId: null, villaTitle: null },
      { id: afterAddRowId, url: "", houseId: null, villaTitle: null },
    ]);
  });

  it("redirects login for auth-failure 401 and known 403 messages only", () => {
    expect(shouldRedirectTikTokToLogin(401, null)).toBe(true);
    expect(shouldRedirectTikTokToLogin(403, { error: "Invalid or expired Supabase session. Please sign in again." })).toBe(true);
    expect(shouldRedirectTikTokToLogin(403, { error: "Signed-in user is not listed as an active home config admin." })).toBe(true);
    expect(shouldRedirectTikTokToLogin(403, { error: "Invalid or expired Supabase session. Please sign in again.", code: "42501" })).toBe(false);
    expect(shouldRedirectTikTokToLogin(403, { error: "Unable to verify admin access: code: 42501" })).toBe(false);
    expect(shouldRedirectTikTokToLogin(403, { error: "Some other permission error" })).toBe(false);
    expect(shouldRedirectTikTokToLogin(403, null)).toBe(false);
    expect(shouldRedirectTikTokToLogin(500, null)).toBe(false);
  });
});
