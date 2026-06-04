import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { getTikTokPreviewSettings } from "../oembed";

describe("getTikTokPreviewSettings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads TikTok thumbnail metadata for the first six unique videos", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      const videoUrl = url.searchParams.get("url") ?? "";
      const videoId = videoUrl.split("/").pop() ?? "unknown";

      return Response.json({
        author_name: "@baanpoolvilla",
        thumbnail_url: `https://p16-sign.tiktokcdn-us.com/${videoId}.jpeg`,
        title: `Clip ${videoId}`,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getTikTokPreviewSettings({
      accountUrl: " https://www.tiktok.com/@baanpoolvilla ",
      videos: [
        "1",
        "2",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
      ].map((id) => ({
        url: `https://www.tiktok.com/@baanpoolvilla/video/${id}`,
        videoId: id,
      })),
    });

    expect(result.accountUrl).toBe("https://www.tiktok.com/@baanpoolvilla");
    expect(result.videos).toHaveLength(6);
    expect(result.videos.map((video) => video.videoId)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
    expect(result.videos[0]).toMatchObject({
      authorName: "@baanpoolvilla",
      thumbnailUrl: "https://p16-sign.tiktokcdn-us.com/1.jpeg",
      title: "Clip 1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        next: {
          revalidate: CACHE_REVALIDATE_SECONDS.tiktokOEmbed,
          tags: [CACHE_TAGS.tiktokOEmbed, CACHE_TAGS.siteSettings],
        },
      }),
    );
  });

  it("keeps videos visible without thumbnails when oEmbed fails or returns unsafe thumbnails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ thumbnail_url: "http://example.com/cover.jpg" }))
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getTikTokPreviewSettings({
      accountUrl: "https://www.tiktok.com/@baanpoolvilla",
      videos: ["1", "2", "3"].map((id) => ({
        url: `https://www.tiktok.com/@baanpoolvilla/video/${id}`,
        videoId: id,
      })),
    });

    expect(result.videos).toEqual([
      {
        authorName: "",
        thumbnailUrl: "",
        title: "",
        url: "https://www.tiktok.com/@baanpoolvilla/video/1",
        videoId: "1",
      },
      {
        authorName: "",
        thumbnailUrl: "",
        title: "",
        url: "https://www.tiktok.com/@baanpoolvilla/video/2",
        videoId: "2",
      },
      {
        authorName: "",
        thumbnailUrl: "",
        title: "",
        url: "https://www.tiktok.com/@baanpoolvilla/video/3",
        videoId: "3",
      },
    ]);
  });
});
