import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { VillaCard } from "@/components/villas/listing/villa-card";
import type { GuidePost } from "@/lib/guides/types";
import type { VillaListing } from "@/lib/villas/types";

interface GuideDetailPageProps {
  guide: GuidePost;
  recommendedVillas: VillaListing[];
}

interface GuideBlock {
  content?: { text?: unknown }[];
  props?: Record<string, unknown>;
  type?: unknown;
}

function getBlockText(block: GuideBlock): string {
  return (
    block.content
      ?.map((content) => (typeof content.text === "string" ? content.text : ""))
      .join("") ?? ""
  );
}

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

export function getYouTubeEmbedUrl(text: string): string | null {
  for (const token of tokenizeText(text)) {
    const candidate = trimUrlToken(token.trim());

    if (!candidate.startsWith("https://")) {
      continue;
    }

    try {
      const videoId = getYouTubeVideoIdFromUrl(new URL(candidate));

      if (videoId) {
        return `https://www.youtube-nocookie.com/embed/${videoId}`;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function YouTubeEmbed({ embedUrl, title }: { embedUrl: string; title: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-[0_14px_30px_rgba(6,63,53,0.08)]">
      <iframe
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="aspect-video w-full"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        src={embedUrl}
        title={title}
      />
    </div>
  );
}

function GuideContent({ blocks }: { blocks: unknown[] }) {
  return (
    <div className="grid w-full gap-5 text-[var(--site-text)]" data-guide-content>
      {blocks.map((block, index) => {
        if (!block || typeof block !== "object" || Array.isArray(block)) {
          return null;
        }

        const guideBlock = block as GuideBlock;
        const text = getBlockText(guideBlock);
        const youtubeEmbedUrl = getYouTubeEmbedUrl(text);

        switch (guideBlock.type) {
          case "heading":
            return (
              <h2
                className="pt-4 text-2xl font-semibold leading-tight sm:text-3xl"
                key={index}
              >
                {text}
              </h2>
            );
          case "quote":
            return (
              <blockquote
                className="border-l-4 border-[var(--site-primary)] pl-4 text-xl font-medium leading-9 text-[var(--site-text)]"
                key={index}
              >
                {text}
              </blockquote>
            );
          case "bulletListItem":
          case "numberedListItem":
          case "checkListItem":
            return (
              <p
                className="rounded-md bg-[var(--site-surface)] px-4 py-3 text-base leading-8 text-[var(--site-text)]"
                key={index}
              >
                {guideBlock.type === "checkListItem" ? "✓ " : "• "}
                {text}
              </p>
            );
          case "image": {
            const imageUrl = getImageUrl(guideBlock);

            if (!imageUrl) {
              return null;
            }

            return (
              <figure className="grid gap-2 py-3" key={index}>
                <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-[var(--site-surface-tint)]">
                  <Image
                    alt={getImageAlt(guideBlock, "รูปประกอบบทความ")}
                    className="object-cover"
                    fill
                    sizes="(max-width: 768px) 100vw, 768px"
                    src={imageUrl}
                  />
                </div>
                <figcaption className="text-sm text-[var(--site-muted)]">
                  {getImageAlt(guideBlock, "")}
                </figcaption>
              </figure>
            );
          }
          default:
            if (youtubeEmbedUrl) {
              return (
                <YouTubeEmbed
                  embedUrl={youtubeEmbedUrl}
                  key={index}
                  title={`${text} - YouTube`}
                />
              );
            }

            return (
              <p className="text-lg leading-9 text-[var(--site-text)]" key={index}>
                {text}
              </p>
            );
        }
      })}
    </div>
  );
}

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
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--site-primary)]"
          href={`/villas/${villas[0].id}`}
        >
          ดูรายละเอียดบ้านพัก <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        {villas.slice(0, 6).map((villa, index) => (
          <VillaCard key={villa.id} villa={villa} preload={index === 0} />
        ))}
      </div>
    </aside>
  );
}

export function GuideDetailPage({
  guide,
  recommendedVillas,
}: GuideDetailPageProps) {
  const coverImageUrl = guide.coverImage?.url;

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
          </div>

          {coverImageUrl ? (
            <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-lg bg-[var(--site-surface-tint)]">
              <Image
                alt={guide.coverImage?.alt ?? guide.title}
                className="object-cover"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 1024px"
                src={coverImageUrl}
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
    </main>
  );
}
