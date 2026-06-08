import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { GuidePost } from "@/lib/guides/types";

import { GuideDetailPage, getYouTubeEmbedUrl } from "../guide-detail-page";

function makeGuide(contentBlocks: unknown[]): GuidePost {
  return {
    id: "guide-1",
    title: "Guide",
    slug: "guide",
    excerpt: "Guide excerpt",
    coverImage: null,
    contentBlocks,
    tags: ["tag"],
    recommendedHouseIds: [],
    status: "published",
    isPinned: false,
    publishedAt: "2026-06-03T00:00:00.000Z",
    createdAt: "2026-06-03T00:00:00.000Z",
    updatedAt: "2026-06-03T00:00:00.000Z",
  };
}

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

  it("renders saved link marks as safe public links", () => {
    const markup = renderToStaticMarkup(
      <GuideDetailPage
        guide={makeGuide([
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Open villa",
                marks: [{ type: "link", attrs: { href: "/villas/66" } }],
              },
            ],
          },
        ])}
        recommendedVillas={[]}
        relatedGuides={[]}
      />,
    );

    expect(markup).toContain('href="/villas/66"');
    expect(markup).toContain(">Open villa</a>");
  });

  it("renders unsafe link marks as plain text", () => {
    const markup = renderToStaticMarkup(
      <GuideDetailPage
        guide={makeGuide([
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Unsafe link",
                marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
              },
            ],
          },
        ])}
        recommendedVillas={[]}
        relatedGuides={[]}
      />,
    );

    expect(markup).toContain("Unsafe link");
    expect(markup).not.toContain("javascript:alert");
  });

  it("renders YouTube links as thumbnail posters without loading embeds before play", () => {
    const markup = renderToStaticMarkup(
      <GuideDetailPage
        guide={makeGuide([
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "https://youtu.be/dQw4w9WgXcQ",
              },
            ],
          },
        ])}
        recommendedVillas={[]}
        relatedGuides={[]}
      />,
    );

    expect(markup).toContain("i.ytimg.com%2Fvi%2FdQw4w9WgXcQ%2Fhqdefault.jpg");
    expect(markup).not.toContain("<iframe");
    expect(markup).not.toContain("youtube.com/embed");
    expect(markup).not.toContain("youtube-nocookie.com/embed");
  });
});
