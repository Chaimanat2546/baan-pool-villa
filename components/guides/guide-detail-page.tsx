import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { GuidePost } from "@/lib/guides/types";
import type { VillaListing } from "@/lib/villas/types";
import { VillaCard } from "@/components/villas/listing/villa-card";

interface GuideDetailPageProps {
  guide: GuidePost;
  recommendedVillas: VillaListing[];
}

interface GuideBlock {
  content?: Array<{ text?: unknown }>;
  props?: Record<string, unknown>;
  type?: unknown;
}

function getBlockText(block: GuideBlock): string {
  return block.content
    ?.map((content) => (typeof content.text === "string" ? content.text : ""))
    .join("") ?? "";
}

function getImageUrl(block: GuideBlock): string | null {
  const url = block.props?.url;

  return typeof url === "string" && url.length > 0 ? url : null;
}

function getImageAlt(block: GuideBlock, fallback: string): string {
  const alt = block.props?.alt;

  return typeof alt === "string" && alt.length > 0 ? alt : fallback;
}

function GuideContent({ blocks }: { blocks: unknown[] }) {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5 px-4 py-8 text-[var(--site-text)] sm:px-6 lg:px-0">
      {blocks.map((block, index) => {
        if (!block || typeof block !== "object" || Array.isArray(block)) {
          return null;
        }

        const guideBlock = block as GuideBlock;
        const text = getBlockText(guideBlock);

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

function RecommendedVillaSection({
  compact = false,
  villas,
}: {
  compact?: boolean;
  villas: VillaListing[];
}) {
  if (villas.length === 0) {
    return null;
  }

  return (
    <section
      className={`mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 ${
        compact ? "py-8" : "py-10 lg:py-14"
      }`}
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--site-text)]">
            บ้านพักที่แนะนำในบทความนี้
          </h2>
          <p className="mt-1 text-sm text-[var(--site-muted)]">
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {villas.slice(0, compact ? 3 : 6).map((villa, index) => (
          <VillaCard key={villa.id} villa={villa} preload={index === 0} />
        ))}
      </div>
    </section>
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

        <RecommendedVillaSection compact villas={recommendedVillas} />
        <GuideContent blocks={guide.contentBlocks} />
        <RecommendedVillaSection villas={recommendedVillas} />
      </article>
    </main>
  );
}
