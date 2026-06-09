import { ArrowRight, FileText, Pin } from "lucide-react";
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
      className="group block overflow-hidden rounded-[24px] border border-[var(--site-border)] bg-[var(--site-surface)] p-px shadow-[0_10px_15px_-3px_rgba(0,0,0,0.05),0_4px_6px_-2px_rgba(0,0,0,0.05)] transition hover:-translate-y-1 hover:border-[var(--site-border-strong)] hover:shadow-[0_18px_28px_-8px_rgba(15,47,53,0.18)]"
      href={`/guides/${guide.slug}`}
      prefetch={false}
    >
      <div className="relative h-[216px] w-full overflow-hidden rounded-[23px] rounded-b-none bg-[var(--site-surface-tint)]">
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
          <div className="grid h-full place-items-center text-sm font-semibold text-[var(--site-muted)]">
            บทความบ้านพัก
          </div>
        )}
      </div>
      <article className="grid gap-3 p-4">
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
      </article>
    </Link>
  );
}

export function GuideListPage({ guides }: GuideListPageProps) {
  return (
    <main className="min-h-screen bg-[var(--site-surface-soft)] px-4 py-5 text-[var(--site-text)] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="py-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--site-accent)]">
              Baan Pool Villa Guide
            </p>
            <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight text-[var(--site-text)] sm:text-4xl">
              บทความแนะนำบ้านพักและทริปพัทยา
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--site-muted)] sm:text-base sm:leading-7">
              รวมวิธีเลือกบ้านพักพูลวิลล่า เตรียมทริป และดูบ้านที่เหมาะกับกลุ่มของคุณ
            </p>
            <nav
              aria-label="ลิงก์ค้นหาบ้านพักจากหน้าบทความ"
              className="mt-4 flex flex-wrap gap-2 text-sm font-bold"
            >
              <Link
                className="rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-1.5 text-[var(--site-primary)] transition hover:border-[var(--site-border-strong)]"
                href="/search"
                prefetch={false}
              >
                ค้นหาบ้านพักทั้งหมด
              </Link>
              <Link
                className="rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-1.5 text-[var(--site-primary)] transition hover:border-[var(--site-border-strong)]"
                href="/"
                prefetch={false}
              >
                กลับหน้าแรก
              </Link>
            </nav>
          </div>
        </header>

        <section className="scroll-mt-6">
          {guides.length === 0 ? (
            <div className="flex min-h-80 items-center justify-center rounded-[24px] border border-[var(--site-border)] bg-[var(--site-surface)] px-6 text-center shadow-[0_14px_42px_rgba(6,63,53,0.06)]">
              <div className="max-w-md">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
                  <FileText className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-2xl font-black text-[var(--site-text)]">
                  ยังไม่มีบทความเผยแพร่
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--site-muted)]">
                  เมื่อเผยแพร่บทความจาก CMS แล้ว บทความจะแสดงในหน้านี้ตามลำดับปักหมุดก่อน
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {guides.map((guide, index) => (
                <GuideCard guide={guide} key={guide.id} priority={index === 0} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
