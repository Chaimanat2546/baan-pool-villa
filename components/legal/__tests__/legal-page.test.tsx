import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { LegalPage } from "@/lib/legal-pages/types";

import { LegalPage as LegalPageRenderer } from "../legal-page";

function createLegalPage(overrides: Partial<LegalPage>): LegalPage {
  return {
    id: "legal-terms",
    slug: "terms",
    title: "Terms and Conditions",
    seoDescription: "Booking terms and conditions",
    contentBlocks: [],
    status: "published",
    publishedAt: "2026-06-08T00:00:00.000Z",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-09T12:00:00.000Z",
    ...overrides,
  };
}

describe("LegalPage renderer", () => {
  it("renders title and updated date", () => {
    const page = createLegalPage({
      title: "Privacy Policy",
      updatedAt: "2026-06-08T00:00:00.000Z",
      contentBlocks: [{ type: "paragraph", content: [{ type: "text", text: "Intro paragraph." }] }],
    });
    const markup = renderToStaticMarkup(<LegalPageRenderer page={page} />);

    expect(markup).toContain("<h1");
    expect(markup).toContain("Privacy Policy");
    expect(markup).toContain('<time dateTime="2026-06-08T00:00:00.000Z">2026-06-08</time>');
  });

  it("renders paragraph, heading, quote, and grouped list blocks", () => {
    const page = createLegalPage({
      contentBlocks: [
        { type: "paragraph", content: [{ type: "text", text: "Paragraph body." }] },
        { type: "heading", content: [{ type: "text", text: "Terms" }] },
        { type: "quote", content: [{ type: "text", text: "Please read carefully." }] },
        { type: "bulletListItem", content: [{ type: "text", text: "Item one" }] },
        { type: "bulletListItem", content: [{ type: "text", text: "Item two" }] },
        { type: "numberedListItem", content: [{ type: "text", text: "Step one" }] },
        { type: "numberedListItem", content: [{ type: "text", text: "Step two" }] },
        { type: "paragraph", content: [{ type: "text", text: "After lists." }] },
      ],
    });
    const markup = renderToStaticMarkup(<LegalPageRenderer page={page} />);

    expect(markup).toContain("<p");
    expect(markup).toContain("Paragraph body.");
    expect(markup).toContain("<h2");
    expect(markup).toContain("Terms");
    expect(markup).toContain("<blockquote");
    expect(markup).toContain("Please read carefully.");

    expect(markup.match(/<ul/g)).toHaveLength(1);
    expect(markup.match(/<li/g)).toHaveLength(4);
    expect(markup.match(/<ol/g)).toHaveLength(1);
  });

  it("ignores unsupported block types and empty text blocks", () => {
    const page = createLegalPage({
      contentBlocks: [
        { type: "unknownType", content: [{ type: "text", text: "Unsupported block." }] },
        { type: "paragraph", content: [{ type: "text", text: "" }] },
        { type: "heading", content: [{ type: "text", text: "Available heading" }] },
      ],
    });

    const markup = renderToStaticMarkup(<LegalPageRenderer page={page} />);

    expect(markup).not.toContain("Unsupported block.");
    expect(markup).not.toContain("<p> </p>");
    expect(markup).toContain("Available heading");
  });

  it("handles null content nodes without crashing", () => {
    const page = createLegalPage({
      contentBlocks: [{ type: "paragraph", content: [null] }],
    });

    expect(() => renderToStaticMarkup(<LegalPageRenderer page={page} />)).not.toThrow();
  });

  it("renders text for malformed marks as plain text when marks is not an array", () => {
    const page = createLegalPage({
      contentBlocks: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Safe", marks: "bad" },
            { type: "text", text: " still visible" },
          ],
        },
      ],
    });

    const markup = renderToStaticMarkup(<LegalPageRenderer page={page} />);

    expect(markup).toContain("Safe still visible");
    expect(markup).not.toContain("href=\"");
  });

  it("renders valid links when marks array contains malformed items", () => {
    const page = createLegalPage({
      contentBlocks: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Safe",
              marks: [null, { type: "link", attrs: { href: "/terms" } }],
            },
          ],
        },
      ],
    });
    const renderPage = () => renderToStaticMarkup(<LegalPageRenderer page={page} />);

    expect(renderPage).not.toThrow();

    const markup = renderPage();

    expect(markup).toContain('href="/terms"');
  });

  it("normalizes only safe relative and http(s) links as anchors", () => {
    const page = createLegalPage({
      contentBlocks: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Internal", marks: [{ type: "link", attrs: { href: "/search" } }] },
            { type: "text", text: " and " },
            { type: "text", text: "External", marks: [{ type: "link", attrs: { href: "https://example.com/path" } }] },
            { type: "text", text: " and " },
            { type: "text", text: "Blocked", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
            { type: "text", text: " and " },
            { type: "text", text: "Protocol relative", marks: [{ type: "link", attrs: { href: "//example.com" } }] },
            { type: "text", text: " and " },
            {
              type: "text",
              text: "Protocol only",
              marks: [{ type: "link", attrs: { href: "mailto:user@example.com" } }],
            },
          ],
        },
      ],
    });

    const markup = renderToStaticMarkup(<LegalPageRenderer page={page} />);

    expect(markup).toContain('href="/search"');
    expect(markup).not.toContain('href="/search" target=');
    expect(markup).toContain('href="https://example.com/path" rel="noreferrer" target="_blank"');
    expect(markup).toContain('rel="noreferrer"');

    expect(markup).toContain("Blocked");
    expect(markup).not.toContain('href="javascript:alert(1)"');
    expect(markup).not.toContain('href="//example.com"');
    expect(markup).not.toContain("mailto:user@example.com");
  });

  it("keeps long content readable by enabling word wrapping in the article", () => {
    const page = createLegalPage({
      contentBlocks: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "A very long paragraph that should naturally wrap without forcing horizontal scrolling across narrow and wide viewports.",
            },
          ],
        },
      ],
    });
    const markup = renderToStaticMarkup(<LegalPageRenderer page={page} />);

    expect(markup).toContain('class="grid gap-5 break-words"');
    expect(markup).toContain('class="break-words whitespace-pre-wrap text-lg leading-8"');
  });
});
