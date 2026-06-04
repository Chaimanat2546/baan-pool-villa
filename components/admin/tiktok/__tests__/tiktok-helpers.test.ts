import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "../../../../lib/site-settings/defaults";

import {
  buildTikTokFormData,
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
        { url: "https://www.tiktok.com/@baanpoolvilla/video/1000000000000000001", videoId: "1" },
        { url: "https://www.tiktok.com/@baanpoolvilla/video/1000000000000000002", videoId: "2" },
      ],
    });

    expect(draft).toMatchObject({
      accountUrl: "https://www.tiktok.com/@baanpoolvilla",
      videoUrls: [
        "https://www.tiktok.com/@baanpoolvilla/video/1000000000000000001",
        "https://www.tiktok.com/@baanpoolvilla/video/1000000000000000002",
      ],
    });
    expect(draft.videoRowIds).toEqual([
      expect.stringContaining("tiktok-row-0"),
      expect.stringContaining("tiktok-row-1"),
    ]);
  });

  it("serializes all video urls into form data including beyond homepage limit", () => {
    const draft = {
      accountUrl: "https://www.tiktok.com/@baanpoolvilla",
      videoRowIds: ["row-1", "row-2", "row-3", "row-4", "row-5", "row-6", "row-7"],
      videoUrls: [
        "https://www.tiktok.com/@a/video/1000000000000000001",
        "https://www.tiktok.com/@a/video/1000000000000000002",
        "https://www.tiktok.com/@a/video/1000000000000000003",
        "https://www.tiktok.com/@a/video/1000000000000000004",
        "https://www.tiktok.com/@a/video/1000000000000000005",
        "https://www.tiktok.com/@a/video/1000000000000000006",
        "https://www.tiktok.com/@a/video/1000000000000000007",
      ],
    };
    const formData = buildTikTokFormData(draft);

    expect(formData.get("tiktokAccountUrl")).toBe(draft.accountUrl);
    expect(JSON.parse(String(formData.get("tiktokVideoUrls")))).toEqual(draft.videoUrls);
  });

  it("keeps row ids paired with urls when adding, moving, and deleting rows", () => {
    const base = {
      accountUrl: "",
      videoRowIds: ["row-1", "row-2", "row-3"],
      videoUrls: [
        "https://www.tiktok.com/@a/video/1",
        "https://www.tiktok.com/@a/video/2",
        "https://www.tiktok.com/@a/video/3",
      ],
    };

    const afterAdd = addTikTokVideoRow(base);
    const afterAddRowId = afterAdd.videoRowIds[3];
    expect(afterAdd.videoRowIds.slice(0, 3)).toEqual(["row-1", "row-2", "row-3"]);
    expect(typeof afterAddRowId).toBe("string");
    expect(afterAddRowId.length).toBeGreaterThan(0);
    expect(afterAdd.videoUrls).toEqual([
      "https://www.tiktok.com/@a/video/1",
      "https://www.tiktok.com/@a/video/2",
      "https://www.tiktok.com/@a/video/3",
      "",
    ]);

    const afterMove = moveTikTokVideoRow(base, 0, 1);
    expect(afterMove.videoUrls).toEqual([
      "https://www.tiktok.com/@a/video/2",
      "https://www.tiktok.com/@a/video/1",
      "https://www.tiktok.com/@a/video/3",
    ]);
    expect(afterMove.videoRowIds).toEqual(["row-2", "row-1", "row-3"]);
    expect(afterMove.videoRowIds.map((id, index) => `${id}:${afterMove.videoUrls[index]}`)).toEqual([
      "row-2:https://www.tiktok.com/@a/video/2",
      "row-1:https://www.tiktok.com/@a/video/1",
      "row-3:https://www.tiktok.com/@a/video/3",
    ]);

    const afterDelete = deleteTikTokVideoRow(afterAdd, 1);
    expect(afterDelete.videoUrls).toEqual([
      "https://www.tiktok.com/@a/video/1",
      "https://www.tiktok.com/@a/video/3",
      "",
    ]);
    expect(afterDelete.videoRowIds).toEqual(["row-1", "row-3", afterAddRowId]);
    expect(afterDelete.videoRowIds.map((id, index) => `${id}:${afterDelete.videoUrls[index]}`)).toEqual([
      "row-1:https://www.tiktok.com/@a/video/1",
      "row-3:https://www.tiktok.com/@a/video/3",
      `${afterAddRowId}:`,
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
