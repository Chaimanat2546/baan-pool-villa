import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

import { ContactSection } from "@/components/layout/contact-section";
import { ArticlesSection } from "@/components/villas/home/articles-section";
import { ScrollRail } from "@/components/villas/home/scroll-rail";
import { VillaCard } from "@/components/villas/listing/villa-card";
import type { GuidePost } from "@/lib/guides/types";
import { buildGuideImageProxyUrl } from "@/lib/public-image-proxy";
import type { SiteSettings } from "@/lib/site-settings/types";
import type { VillaListing } from "@/lib/villas/types";
import { YouTubeLiteEmbed } from "./youtube-lite-embed";

interface GuideDetailPageProps {
  guide: GuidePost;
  recommendedVillas: VillaListing[];
  relatedGuides: GuidePost[];
  settings?: SiteSettings;
}

interface GuideBlock {
  content?: GuideTextContent[];
  props?: Record<string, unknown>;
  type?: unknown;
}

interface GuideTextContent {
  marks?: GuideTextMark[];
  text?: unknown;
}

interface GuideTextMark {
  attrs?: Record<string, unknown>;
  type?: unknown;
}

/**
 * Concatenates the inline text segments from a guide block into a single string.
 *
 * @param block - The guide block whose `content` array contains text segments to extract
 * @returns The joined text from `block.content` or an empty string if no text is present
 */
function getBlockText(block: GuideBlock): string {
  return (
    block.content
      ?.map((content) => (typeof content.text === "string" ? content.text : ""))
      .join("") ?? ""
  );
}

/**
 * Retrieve the `content` array from a guide block.
 *
 * @param block - The guide block to read content from
 * @returns The `content` array from `block` when present, otherwise an empty array
 */
function getBlockContent(block: GuideBlock): GuideTextContent[] {
  return Array.isArray(block.content) ? block.content : [];
}

/**
 * Extracts the image URL from a guide block's props when available.
 *
 * @param block - The guide block to read `props.url` from
 * @returns The `props.url` string if it exists and is non-empty, `null` otherwise
 */
function getImageUrl(block: GuideBlock): string | null {
  const url = block.props?.url;

  return typeof url === "string" && url.length > 0 ? url : null;
}

function getImageAlt(block: GuideBlock, fallback: string): string {
  const alt = block.props?.alt;

  return typeof alt === "string" && alt.length > 0 ? alt : fallback;
}

function isAllowedYouTubeIdCharacter(character: string): boolean {
  return (
    (character >= "a" && character <= "z") ||
    (character >= "A" && character <= "Z") ||
    (character >= "0" && character <= "9") ||
    character === "_" ||
    character === "-"
  );
}

function normalizeYouTubeId(value: string | null): string | null {
  if (!value || value.length !== 11) {
    return null;
  }

  for (const character of value) {
    if (!isAllowedYouTubeIdCharacter(character)) {
      return null;
    }
  }

  return value;
}

function trimUrlToken(value: string): string {
  let end = value.length;

  while (end > 0) {
    const character = value[end - 1];

    if (
      character === "." ||
      character === "," ||
      character === ")" ||
      character === "]" ||
      character === "}"
    ) {
      end -= 1;
    } else {
      break;
    }
  }

  return value.slice(0, end);
}

function tokenizeText(value: string): string[] {
  const tokens: string[] = [];
  let current = "";

  for (const character of value) {
    if (character.trim().length === 0) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += character;
    }
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function getYouTubeVideoIdFromUrl(url: URL): string | null {
  const hostname = url.hostname.toLowerCase();
  const segments = url.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (hostname === "youtu.be") {
    return normalizeYouTubeId(segments[0] ?? null);
  }

  if (
    hostname === "youtube.com" ||
    hostname === "www.youtube.com" ||
    hostname === "m.youtube.com" ||
    hostname === "youtube-nocookie.com" ||
    hostname === "www.youtube-nocookie.com"
  ) {
    if (segments[0] === "watch") {
      return normalizeYouTubeId(url.searchParams.get("v"));
    }

    if (segments[0] === "shorts" || segments[0] === "embed") {
      return normalizeYouTubeId(segments[1] ?? null);
    }
  }

  return null;
}

/**
 * Extracts the first YouTube embed URL found within a whitespace-separated text string.
 *
 * @param text - The text to scan for YouTube URL tokens.
 * @returns The embed URL in the form `https://www.youtube-nocookie.com/embed/<videoId>` if a valid YouTube link is found, `null` otherwise.
 */
export function getYouTubeEmbedUrl(text: string): string | null {
  const videoId = getYouTubeVideoIdFromText(text);

  return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
}

function getYouTubeVideoIdFromText(text: string): string | null {
  for (const token of tokenizeText(text)) {
    const candidate = trimUrlToken(token.trim());

    if (!candidate.startsWith("https://")) {
      continue;
    }

    try {
      const videoId = getYouTubeVideoIdFromUrl(new URL(candidate));

      if (videoId) {
        return videoId;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Convert an arbitrary value into a canonical public hyperlink or return `null` if it isn't a usable link.
 *
 * @param value - The candidate href to normalize; may be any type.
 * @returns A usable href string: either a relative path beginning with `/` (but not `//`) or an absolute `http(s)` URL; `null` when the input is not a valid public link.
 */
function normalizePublicLinkHref(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const href = value.trim();

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

function normalizePublicTextColor(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const color = value.trim();

  if (
    color.length === 0 ||
    color.length > 80 ||
    color.includes(";") ||
    color.includes("<") ||
    color.includes(">") ||
    /[\u0000-\u001f\u007f]/.test(color)
  ) {
    return null;
  }

  return color;
}

function renderMarkedInlineContent(
  text: string,
  marks: GuideTextMark[] | undefined,
  keyPrefix: string,
): ReactNode {
  if (!Array.isArray(marks) || marks.length === 0) {
    return text;
  }

  return marks.reduceRight<ReactNode>((node, mark, markIndex) => {
    const key = `${keyPrefix}-${markIndex}`;

    switch (mark.type) {
      case "bold":
        return <strong key={key}>{node}</strong>;
      case "italic":
        return <em key={key}>{node}</em>;
      case "underline":
        return (
          <span className="underline underline-offset-4" key={key}>
            {node}
          </span>
        );
      case "textColor": {
        const color = normalizePublicTextColor(mark.attrs?.color);

        return color ? (
          <span key={key} style={{ color } as CSSProperties}>
            {node}
          </span>
        ) : (
          node
        );
      }
      case "link": {
        const href = normalizePublicLinkHref(mark.attrs?.href);

        if (!href) {
          return node;
        }

        const isExternal =
          href.startsWith("http://") || href.startsWith("https://");

        return (
          <a
            className="font-semibold text-[var(--site-primary)] underline underline-offset-4 transition hover:text-[var(--site-primary-hover)]"
            href={href}
            key={key}
            rel={isExternal ? "noopener noreferrer" : undefined}
            target={isExternal ? "_blank" : undefined}
          >
            {node}
          </a>
        );
      }
      default:
        return node;
    }
  }, text);
}

/**
 * Convert inline guide text segments into renderable React nodes, turning link marks into anchor elements when a valid href is present.
 *
 * @param content - An array of inline text segments (each may contain `text` and optional `marks` describing links or formatting)
 * @returns An array of React nodes: plain text strings for segments without a valid link and `<a>` elements for segments with a normalized link. External links use `target="_blank"` and `rel="noopener noreferrer"`.
 */
function renderInlineContent(content: GuideTextContent[]): ReactNode[] {
  return content.flatMap((item, index) => {
    if (typeof item.text !== "string" || item.text.length === 0) {
      return [];
    }

    return renderMarkedInlineContent(item.text, item.marks, `guide-text-${index}`);
  });
}

/**
 * Renders a styled responsive iframe for an embedded YouTube video.
 *
 * @param embedUrl - Absolute URL to load into the iframe (typically a YouTube embed URL)
 * @param title - Accessible title for the iframe content
 * @returns A React element containing a responsive, styled iframe for the provided `embedUrl`
 */
function YouTubeEmbed({ title, videoId }: { title: string; videoId: string }) {
  return <YouTubeLiteEmbed title={title} videoId={videoId} />;
}

function isGuideBlockListType(
  type: unknown,
): type is "bulletListItem" | "numberedListItem" | "checkListItem" {
  return (
    type === "bulletListItem" ||
    type === "numberedListItem" ||
    type === "checkListItem"
  );
}

/**
 * Renders guide content blocks into corresponding HTML elements and embeds.
 *
 * Converts each block in `blocks` into the appropriate element based on its `type`:
 * - "heading" → <h2>
 * - "quote" → <blockquote>
 * - "bulletListItem", "numberedListItem", "checkListItem" → styled callout paragraph (checkListItem prefixed with "✓")
 * - "image" → <figure> with responsive Image and caption (skips if image URL is missing)
 * - default → paragraph or YouTube embed if a YouTube URL is detected in the block text
 *
 * Inline text marks (links) are rendered using `renderInlineContent`, and YouTube URLs discovered in block text are converted to no-cookie embed URLs via `getYouTubeEmbedUrl`.
 *
 * @param blocks - Array of raw guide blocks (each expected to be an object shaped like `GuideBlock`); non-object or array entries are ignored.
 * @returns A JSX element containing the rendered guide content grid.
 */
function GuideContent({ blocks }: { blocks: unknown[] }) {
  const contentNodes: ReactNode[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];

    if (!block || typeof block !== "object" || Array.isArray(block)) {
      continue;
    }

    const guideBlock = block as GuideBlock;

    if (isGuideBlockListType(guideBlock.type)) {
      const listType = guideBlock.type;
      const listItems: ReactNode[] = [];
      let listIndex = index;

      while (listIndex < blocks.length) {
        const nextBlock = blocks[listIndex];

        if (
          !nextBlock ||
          typeof nextBlock !== "object" ||
          Array.isArray(nextBlock)
        ) {
          break;
        }

        const nextGuideBlock = nextBlock as GuideBlock;

        if (nextGuideBlock.type !== listType) {
          break;
        }

        listItems.push(
          <li key={listIndex}>
            {renderInlineContent(getBlockContent(nextGuideBlock))}
          </li>,
        );
        listIndex += 1;
      }

      if (listType === "numberedListItem") {
        contentNodes.push(
          <ol
            className="guide-public-list guide-public-list-ordered"
            key={index}
          >
            {listItems}
          </ol>,
        );
      } else if (listType === "checkListItem") {
        contentNodes.push(
          <ul className="guide-public-list guide-public-check-list" key={index}>
            {listItems}
          </ul>,
        );
      } else {
        contentNodes.push(
          <ul className="guide-public-list guide-public-bullet-list" key={index}>
            {listItems}
          </ul>,
        );
      }

      index = listIndex - 1;
      continue;
    }

    const text = getBlockText(guideBlock);
    const inlineContent = renderInlineContent(getBlockContent(guideBlock));
    const youtubeVideoId = getYouTubeVideoIdFromText(text);

    switch (guideBlock.type) {
      case "heading":
        contentNodes.push(
          <h2
            className="pt-3 text-2xl font-semibold leading-tight sm:text-3xl"
            key={index}
          >
            {inlineContent}
          </h2>,
        );
        break;
      case "quote":
        contentNodes.push(
          <blockquote
            className="border-l-4 border-[var(--site-primary)] pl-4 text-xl font-medium leading-9 text-[var(--site-text)]"
            key={index}
          >
            {inlineContent}
          </blockquote>,
        );
        break;
      case "image": {
        const imageUrl = buildGuideImageProxyUrl(getImageUrl(guideBlock), {
          quality: 75,
          width: 1200,
        });

        if (!imageUrl) {
          break;
        }

        contentNodes.push(
          <figure className="grid gap-2 py-3" key={index}>
            <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-[var(--site-surface-tint)]">
              <Image
                alt={getImageAlt(guideBlock, "รูปประกอบบทความ")}
                className="object-cover"
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                src={imageUrl}
                unoptimized
              />
            </div>
            <figcaption className="text-sm text-[var(--site-muted)]">
              {getImageAlt(guideBlock, "")}
            </figcaption>
          </figure>,
        );
        break;
      }
      default:
        if (youtubeVideoId) {
          contentNodes.push(
            <YouTubeEmbed
              key={index}
              title={`${text} - YouTube`}
              videoId={youtubeVideoId}
            />,
          );
          break;
        }

        contentNodes.push(
          <p className="text-lg leading-9 text-[var(--site-text)]" key={index}>
            {inlineContent}
          </p>,
        );
        break;
    }
  }

  return (
    <div
      className="grid w-full gap-0 text-[var(--site-text)]"
      data-guide-content
    >
      {contentNodes}
    </div>
  );
}

/**
 * Render a sidebar showing up to six recommended villa cards for the guide.
 *
 * The component displays a localized heading and explanatory text, a horizontal
 * scroll rail of villa cards for small screens, and a vertical list for larger
 * screens. If `villas` is empty, nothing is rendered.
 *
 * @param villas - Array of villa listings to show; only the first six items are displayed
 * @returns A sidebar JSX element containing the recommended villa cards, or `null` when `villas` is empty
 */
function RecommendedVillaSidebar({ villas }: { villas: VillaListing[] }) {
  if (villas.length === 0) {
    return null;
  }

  return (
    <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start" data-guide-sidebar>
      <div className="mb-4 grid gap-2">
        <div>
          <h2 className="text-xl font-semibold leading-7 text-[var(--site-text)]">
            บ้านพักที่แนะนำในบทความนี้
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
            เริ่มดูบ้านที่ตรงกับคำแนะนำก่อน แล้วค่อยคุยรายละเอียดการจอง
          </p>
        </div>
      </div>
      <div className="lg:hidden">
        <ScrollRail
          label="บ้านพักแนะนำ"
          className="-mx-4 mt-4 gap-5 px-4 py-4 sm:-mx-6 sm:px-6"
          controlsClassName="sm:hidden"
        >
          {villas.slice(0, 6).map((villa) => (
            <div key={villa.id} className="w-[290px] shrink-0 snap-start">
              <VillaCard villa={villa} />
            </div>
          ))}
        </ScrollRail>
      </div>

      <div className="hidden gap-4 lg:grid lg:grid-cols-1">
        {villas.slice(0, 6).map((villa) => (
          <VillaCard key={villa.id} villa={villa} />
        ))}
      </div>
    </aside>
  );
}

/**
 * Render the guide detail page including the guide header, article content blocks, a recommended-villas sidebar, and a related-articles section.
 *
 * @param guide - Guide post data to display (title, excerpt, tags, cover image, and content blocks)
 * @param recommendedVillas - List of villa listings to show in the sidebar (up to the first 6 are used)
 * @param relatedGuides - List of related guide posts displayed in the related-articles section
 * @returns The rendered page element for the guide detail view
 */
export function GuideDetailPage({
  guide,
  recommendedVillas,
  relatedGuides,
  settings,
}: GuideDetailPageProps) {
  const coverImageUrl = buildGuideImageProxyUrl(guide.coverImage?.url ?? null, {
    quality: 75,
    width: 1200,
  });

  return (
    <main className="bg-[var(--site-surface-soft)] text-[var(--site-text)]">
      <article>
        <header className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="max-w-3xl">
            <div className="flex flex-wrap gap-2">
              {guide.tags.map((tag) => (
                <span
                  className="rounded-full bg-[var(--site-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--site-text)]"
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
              {guide.title}
            </h1>
            <p className="mt-4 text-lg leading-8 text-[var(--site-muted)]">
              {guide.excerpt}
            </p>
            <nav
              aria-label="ลิงก์ต่อจากบทความ"
              className="mt-5 flex flex-wrap gap-2 text-sm font-bold"
            >
              <a
                className="rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-1.5 text-[var(--site-primary)] transition hover:border-[var(--site-border-strong)]"
                href="/search"
              >
                ค้นหาบ้านพักพูลวิลล่า
              </a>
              <a
                className="rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-1.5 text-[var(--site-primary)] transition hover:border-[var(--site-border-strong)]"
                href="/guides"
              >
                อ่านบทความอื่น
              </a>
            </nav>
          </div>

          {coverImageUrl ? (
            <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-lg bg-[var(--site-surface-tint)]">
              <Image
                alt={guide.coverImage?.alt ?? guide.title}
                className="object-cover"
                fill
                preload
                sizes="(max-width: 1024px) 100vw, 1024px"
                src={coverImageUrl}
                unoptimized
              />
            </div>
          ) : null}
        </header>

        <div
          className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)] lg:px-8 lg:py-14"
          data-guide-detail-layout
        >
          <GuideContent blocks={guide.contentBlocks} />
          <RecommendedVillaSidebar villas={recommendedVillas} />
        </div>
      </article>
      {settings ? <ContactSection settings={settings} /> : null}
      <ArticlesSection guides={relatedGuides} />
    </main>
  );
}
