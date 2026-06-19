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

  it("renders saved rich text marks on public guide content", () => {
    const markup = renderToStaticMarkup(
      <GuideDetailPage
        guide={makeGuide([
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Styled text",
                marks: [
                  { type: "bold" },
                  { type: "italic" },
                  { type: "underline" },
                  { type: "textColor", attrs: { color: "#c026d3" } },
                ],
              },
            ],
          },
        ])}
        recommendedVillas={[]}
        relatedGuides={[]}
      />,
    );

    expect(markup).toContain("<strong>");
    expect(markup).toContain("<em>");
    expect(markup).toContain('class="underline underline-offset-4"');
    expect(markup).toContain('style="color:#c026d3"');
  });

  it("groups adjacent guide list blocks into real public lists", () => {
    const markup = renderToStaticMarkup(
      <GuideDetailPage
        guide={makeGuide([
          {
            type: "bulletListItem",
            content: [{ type: "text", text: "First item" }],
          },
          {
            type: "bulletListItem",
            content: [{ type: "text", text: "Second item" }],
          },
          {
            type: "numberedListItem",
            content: [{ type: "text", text: "Number one" }],
          },
        ])}
        recommendedVillas={[]}
        relatedGuides={[]}
      />,
    );

    expect(markup).toContain(
      '<ul class="guide-public-list guide-public-bullet-list"><li>First item</li><li>Second item</li></ul>',
    );
    expect(markup).toContain(
      '<ol class="guide-public-list guide-public-list-ordered"><li>Number one</li></ol>',
    );
    expect(markup).not.toContain("• First item");
  });

  it("does not force bullet list text to be semibold", () => {
    const markup = renderToStaticMarkup(
      <GuideDetailPage
        guide={makeGuide([
          {
            type: "bulletListItem",
            content: [{ type: "text", text: "Regular bullet" }],
          },
        ])}
        recommendedVillas={[]}
        relatedGuides={[]}
      />,
    );

    expect(markup).toContain(
      '<ul class="guide-public-list guide-public-bullet-list"><li>Regular bullet</li></ul>',
    );
    expect(markup).not.toContain('<li class="font-semibold">Regular bullet</li>');
  });

  it("keeps adjacent content blocks visually tight so blank blocks control extra spacing", () => {
    const markup = renderToStaticMarkup(
      <GuideDetailPage
        guide={makeGuide([
          {
            type: "paragraph",
            content: [{ type: "text", text: "First paragraph" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Second paragraph" }],
          },
        ])}
        recommendedVillas={[]}
        relatedGuides={[]}
      />,
    );

    expect(markup).toContain('class="grid w-full gap-0 text-[var(--site-text)]"');
  });

  it("renders YouTube links as thumbnail posters before play", () => {
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

    expect(markup).toContain("data-youtube-play-button");
    expect(markup).toContain("i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(markup).not.toContain("<iframe");
    expect(markup).not.toContain("youtube-nocookie.com/embed");
    expect(markup).not.toContain("data-youtube-click-guard");
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
      'data-src="/api/guides/images/guide/cover?w=1200&amp;q=75"',
    );
    expect(markup).toContain(
      'data-src="/api/guides/images/guide/content/0?w=1200&amp;q=75"',
    );
    expect(markup).not.toContain("assets.example.com");
  });
});
