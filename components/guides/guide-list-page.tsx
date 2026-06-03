import { ArrowRight, Pin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { GuidePost } from "@/lib/guides/types";

interface GuideListPageProps {
  guides: GuidePost[];
}

function getGuideImage(guide: GuidePost) {
  return guide.coverImage?.url ?? null;
}

function GuideCard({
  guide,
  priority = false,
}: {
  guide: GuidePost;
  priority?: boolean;
}) {
  const imageUrl = getGuideImage(guide);

  return (
    <Link
      className="group grid overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] transition hover:-translate-y-0.5 hover:border-[var(--site-border-strong)] hover:shadow-[0_18px_36px_rgba(15,47,53,0.14)]"
      href={`/guides/${guide.slug}`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--site-surface-tint)]">
        {imageUrl ? (
          <Image
            alt={guide.coverImage?.alt ?? guide.title}
            className="object-cover transition duration-500 group-hover:scale-105"
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, 33vw"
            src={imageUrl}
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-[var(--site-muted)]">
            บทความบ้านพัก
          </div>
        )}
      </div>
      <div className="grid gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          {guide.isPinned ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--site-primary)] px-2.5 py-1 text-xs font-semibold text-[var(--site-on-primary)]">
              <Pin aria-hidden="true" className="size-3" />
              เด่น
            </span>
          ) : null}
          {guide.tags.slice(0, 2).map((tag) => (
            <span
              className="rounded-full bg-[var(--site-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--site-text)]"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>
        <h2 className="line-clamp-2 text-xl font-semibold leading-7 text-[var(--site-text)]">
          {guide.title}
        </h2>
        <p className="line-clamp-3 text-sm leading-6 text-[var(--site-muted)]">
          {guide.excerpt}
        </p>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--site-primary)]">
          อ่านบทความ <ArrowRight aria-hidden="true" className="size-4" />
        </span>
      </div>
    </Link>
  );
}

export function GuideListPage({ guides }: GuideListPageProps) {
  const pinnedGuides = guides.filter((guide) => guide.isPinned);
  const allGuides = guides;

  return (
    <main className="bg-[var(--site-surface-soft)] text-[var(--site-text)]">
      <section className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-[var(--site-primary)]">
            Baan Pool Villa Guide
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
            บทความแนะนำบ้านพักและทริปพัทยา
          </h1>
          <p className="mt-3 text-base leading-8 text-[var(--site-muted)]">
            รวมวิธีเลือกบ้านพักพูลวิลล่า เตรียมทริป และดูบ้านที่เหมาะกับกลุ่มของคุณ
          </p>
        </div>

        {guides.length === 0 ? (
          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-10 text-center text-sm text-[var(--site-muted)]">
            ยังไม่มีบทความเผยแพร่
          </div>
        ) : null}
      </section>

      {pinnedGuides.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">บทความเด่น</h2>
              <p className="mt-1 text-sm text-[var(--site-muted)]">
                อ่านก่อนเพื่อเลือกบ้านพักได้เร็วขึ้น
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pinnedGuides.map((guide, index) => (
              <GuideCard guide={guide} key={guide.id} priority={index === 0} />
            ))}
          </div>
        </section>
      ) : null}

      {allGuides.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold">บทความทั้งหมด</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allGuides.map((guide, index) => (
              <GuideCard
                guide={guide}
                key={guide.id}
                priority={pinnedGuides.length === 0 && index === 0}
              />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
