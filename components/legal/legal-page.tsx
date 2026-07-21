import type { ReactNode } from "react";

import { ContactSection } from "@/components/layout/contact-section";
import type { LegalPage } from "@/lib/legal-pages/types";
import type { SiteContactSettings } from "@/lib/site-contact-settings/types";

interface LegalTextMark {
  attrs?: {
    href?: unknown;
  };
  type?: unknown;
}

interface LegalTextContent {
  marks?: LegalTextMark[];
  text?: unknown;
}

interface LegalBlock {
  content?: unknown;
  type?: unknown;
}

interface LegalPageProps {
  page: LegalPage;
  settings?: SiteContactSettings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extract block text content for list grouping and content checks.
 *
 * @param block - Legal content block to read text segments from
 * @returns The concatenated text from all text segments, or an empty string
 */
function getBlockTextContent(block: LegalBlock): string {
  return getBlockContent(block)
    .map((content) => (typeof content.text === "string" ? content.text : ""))
    .join("");
}

function getBlockContent(block: LegalBlock): LegalTextContent[] {
  if (!Array.isArray(block.content)) {
    return [];
  }

  return block.content
    .filter((node): node is Record<string, unknown> => isRecord(node))
    .map((node) => {
      const text = typeof node.text === "string" ? node.text : "";
      const marks = Array.isArray(node.marks)
        ? node.marks.filter((mark): mark is LegalTextMark => isRecord(mark))
        : undefined;

      return {
        text,
        ...(marks && marks.length > 0 ? { marks } : undefined),
      };
    });
}

/**
 * Normalize a href for public rendering.
 *
 * Supports:
 * - Relative paths beginning with `/` but not `//`
 * - Absolute `http:` and `https:` URLs
 *
 * @param value - Candidate href value from editor marks
 * @returns Normalized href string, or `null` when unsafe/invalid
 */
function normalizePublicLinkHref(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const href = value.trim();

  if (!href) {
    return null;
  }

  if (href.startsWith("/") && !href.startsWith("//")) {
    return href;
  }

  try {
    const url = new URL(href);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.href;
    }
  } catch {
    return null;
  }

  return null;
}

function isTextLinkMark(mark: unknown): mark is LegalTextMark {
  return isRecord(mark) && mark.type === "link";
}

/**
 * Render inline text segments inside a block.
 *
 * @param content - Ordered inline text nodes for one legal block
 * @returns Render-ready inline React nodes with safe links converted to `<a>`
 */
function renderInlineContent(content: LegalTextContent[]): ReactNode[] {
  return content.flatMap((item, index) => {
    if (typeof item.text !== "string" || item.text.length === 0) {
      return [];
    }

    const linkMark = Array.isArray(item.marks)
      ? item.marks.find(isTextLinkMark)
      : undefined;
    const href = normalizePublicLinkHref(linkMark?.attrs?.href);

    if (!href) {
      return item.text;
    }

    const isExternal = href.startsWith("http://") || href.startsWith("https://");

    return (
      <a
        className="break-words font-semibold text-[var(--site-primary)] underline underline-offset-4 transition hover:text-[var(--site-primary-hover)]"
        href={href}
        key={`${href}-${index}`}
        rel={isExternal ? "noreferrer" : undefined}
        target={isExternal ? "_blank" : undefined}
      >
        {item.text}
      </a>
    );
  });
}

function isSupportedLegalBlockType(type: unknown): type is
  | "paragraph"
  | "heading"
  | "bulletListItem"
  | "numberedListItem"
  | "quote" {
  return (
    type === "paragraph" ||
    type === "heading" ||
    type === "bulletListItem" ||
    type === "numberedListItem" ||
    type === "quote"
  );
}

/**
 * Render legal page blocks with grouped list handling.
 *
 * @param blocks - Raw content blocks from the legal page editor
 * @returns Rendered content nodes in the intended semantic structure
 */
function renderBlocks(blocks: unknown[]): ReactNode[] {
  const renderedBlocks: ReactNode[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const current = blocks[index];

    if (!isRecord(current) || !isSupportedLegalBlockType(current.type)) {
      continue;
    }

    if (current.type === "bulletListItem" || current.type === "numberedListItem") {
      const listType = current.type;
      const listItems: ReactNode[] = [];

      while (index < blocks.length) {
        const next = blocks[index];
        if (!isRecord(next) || next.type !== listType) {
          break;
        }

        const currentContent = getBlockContent(next);
        const listText = getBlockTextContent(next).trim();

        if (listText.length > 0) {
          listItems.push(
            <li className="break-words" key={`${listType}-${index}`}>
              {renderInlineContent(currentContent)}
            </li>,
          );
        }

        index += 1;
      }

      index -= 1;

      if (listItems.length > 0) {
        renderedBlocks.push(
          listType === "bulletListItem" ? (
            <ul
              className="list-disc space-y-2 break-words pl-6 text-[var(--site-text)]"
              key={`${listType}-${index}-${listItems.length}`}
            >
              {listItems}
            </ul>
          ) : (
            <ol
              className="list-decimal space-y-2 break-words pl-6 text-[var(--site-text)]"
              key={`${listType}-${index}-${listItems.length}`}
            >
              {listItems}
            </ol>
          ),
        );
      }

      continue;
    }

    const content = getBlockContent(current);
    const blockText = getBlockTextContent(current).trim();

    if (!blockText) {
      continue;
    }

    const inlineContent = renderInlineContent(content);

    switch (current.type) {
      case "paragraph":
        renderedBlocks.push(
          <p className="break-words whitespace-pre-wrap text-lg leading-8" key={index}>
            {inlineContent}
          </p>,
        );
        break;
      case "heading":
        renderedBlocks.push(
          <h2
            className="break-words whitespace-pre-wrap text-3xl font-semibold leading-tight"
            key={index}
          >
            {inlineContent}
          </h2>,
        );
        break;
      case "quote":
        renderedBlocks.push(
          <blockquote
            className="rounded-md border-l-4 border-[var(--site-primary)] bg-[var(--site-surface)] p-4 text-xl font-medium leading-9 text-[var(--site-text)] break-words whitespace-pre-wrap"
            key={index}
          >
            {inlineContent}
          </blockquote>,
        );
        break;
    }
  }

  return renderedBlocks;
}

function formatUpdatedDate(dateValue: string | null): string | null {
  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

/**
 * Render a legal page with semantic blocks for terms/privacy content.
 *
 * @param page - Legal page payload from server
 * @returns The legal page article with safe links and list grouping
 */
export function LegalPage({ page, settings }: LegalPageProps) {
  const updatedText = formatUpdatedDate(page.updatedAt ?? "");

  return (
    <main className="bg-[var(--site-bg)] text-[var(--site-text)]">
      <article className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <header className="space-y-2">
          <h1 className="break-words text-4xl font-semibold leading-tight">
            {page.title}
          </h1>
          {updatedText ? (
            <p className="text-sm text-[var(--site-muted)]">
              Updated: <time dateTime={page.updatedAt}>{updatedText}</time>
            </p>
          ) : null}
        </header>
        <section className="grid gap-5 break-words" data-legal-page-content>
          {renderBlocks(page.contentBlocks as unknown[])}
        </section>
      </article>
      {settings ? <ContactSection settings={settings} /> : null}
    </main>
  );
}
