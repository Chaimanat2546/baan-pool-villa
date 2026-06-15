import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { GuidePost } from "@/lib/guides/types";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";

import { GuideDetailPage, getYouTubeEmbedUrl } from "../guide-detail-page";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span aria-label={alt} data-src={src} />
  ),
}));

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

    expect(markup).toContain("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(markup).not.toContain("<iframe");
    expect(markup).not.toContain("youtube.com/embed");
    expect(markup).not.toContain("youtube-nocookie.com/embed");
  });

  it("renders the contact section before related articles when settings are provided", () => {
    const markup = renderToStaticMarkup(
      <GuideDetailPage
        guide={makeGuide([])}
        recommendedVillas={[]}
        relatedGuides={[{ ...makeGuide([]), id: "guide-2", slug: "guide-2" }]}
        settings={DEFAULT_SITE_SETTINGS}
      />,
    );

    expect(markup).toContain('<section id="contact"');
    expect(markup).toContain("data-home-guides");
    expect(markup.indexOf('<section id="contact"')).toBeLessThan(
      markup.indexOf("data-home-guides"),
    );
  });

  it("renders cover and inline guide images through the public guide image proxy", () => {
    const markup = renderToStaticMarkup(
      <GuideDetailPage
        guide={{
          ...makeGuide([
            {
              type: "image",
              props: {
                alt: "Inline",
                url: "https://assets.example.com/inline.jpg",
              },
            },
          ]),
          coverImage: {
            alt: "Cover",
            path: "cover.jpg",
            url: "https://assets.example.com/cover.jpg",
          },
        }}
        recommendedVillas={[]}
        relatedGuides={[]}
      />,
    );

    expect(markup).toContain(
      'data-src="/api/guides/images/proxy?url=https%3A%2F%2Fassets.example.com%2Fcover.jpg&amp;w=1200&amp;q=75"',
    );
    expect(markup).toContain(
      'data-src="/api/guides/images/proxy?url=https%3A%2F%2Fassets.example.com%2Finline.jpg&amp;w=1200&amp;q=75"',
    );
  });
});
