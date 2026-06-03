import { describe, expect, it } from "vitest";

import { getYouTubeEmbedUrl } from "../guide-detail-page";

describe("getYouTubeEmbedUrl", () => {
  it("converts supported YouTube URLs to privacy-enhanced embed URLs", () => {
    expect(getYouTubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(
      getYouTubeEmbedUrl("ดูคลิป https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(
      getYouTubeEmbedUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ."),
    ).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("ignores unsupported or unsafe URLs", () => {
    expect(getYouTubeEmbedUrl("http://youtu.be/dQw4w9WgXcQ")).toBeNull();
    expect(getYouTubeEmbedUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(getYouTubeEmbedUrl("https://youtu.be/not-valid")).toBeNull();
  });
});
