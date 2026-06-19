import { ArrowRight, Pin } from "lucide-react";
import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";

import {
  toPublicGuideSummaries,
  type PublicGuideSummary,
} from "@/lib/guides/public-dto";
import { buildGuideCoverImageProxyPath } from "@/lib/public-image-proxy";
import type { GuidePost } from "@/lib/guides/types";
import { ScrollRail } from "@/components/ui/scroll-rail";

import { SectionHeader } from "./section-header";

const HOME_GUIDE_LIMIT = 7;

interface ArticlesSectionProps {
  guides: PublicGuideSummary[];
}

export function selectHomeGuideSummaries(
  guides: GuidePost[],
): PublicGuideSummary[] {
  return toPublicGuideSummaries(guides).slice(0, HOME_GUIDE_LIMIT);
}

function getGuideImage(guide: PublicGuideSummary) {
  return guide.hasCoverImage
    ? buildGuideCoverImageProxyPath(guide.slug, {
        quality: 60,
        width: 640,
      })
    : null;
}

export function ArticlesSection({ guides }: ArticlesSectionProps) {
  const visibleGuides = guides.slice(0, HOME_GUIDE_LIMIT);

  if (visibleGuides.length === 0) {
    return null;
  }

  return (
    <section
      id="guides"
      className="mx-auto w-full max-w-7xl scroll-mt-28 px-4 py-14 sm:px-6 lg:px-8"
      data-home-guides
    >
      <SectionHeader
        title="บทความแนะนำ"
        description="อ่านไกด์เลือกพูลวิลล่า วิธีเตรียมทริป และบ้านพักที่เหมาะกับกลุ่มของคุณ"
      />
      <ScrollRail
        label="บทความแนะนำ"
        className="-mx-4 mt-8 gap-6 px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {visibleGuides.map((guide) => {
          const imageUrl = getGuideImage(guide);

          return (
            <a
              className="group w-[306px] shrink-0 snap-start overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] shadow-[0_12px_34px_rgba(6,63,53,0.07)] transition hover:-translate-y-0.5 hover:border-[var(--site-border-strong)] hover:shadow-[0_18px_36px_rgba(15,47,53,0.14)] md:w-[394px]"
              href={`/guides/${guide.slug}`}
              key={guide.id}
            >
              <div className="relative aspect-[4/3] bg-[var(--site-surface-tint)]">
                {imageUrl ? (
                  <Image
                    alt={guide.coverImageAlt ?? guide.title}
                    className="object-cover transition duration-500 group-hover:scale-105"
                    fill
                    sizes="(max-width: 768px) 306px, 394px"
                    src={imageUrl}
                    unoptimized
                  />
                ) : (
                  <div className="grid h-full place-items-center text-sm font-semibold text-[var(--site-muted)]">
                    บทความบ้านพัก
                  </div>
                )}
                <div className="absolute left-3 right-3 top-3 flex flex-wrap gap-2">
                  {guide.isPinned ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--site-primary)] px-3 py-1 text-xs font-semibold text-[var(--site-on-primary)] shadow-[0_8px_18px_rgba(6,63,53,0.16)]">
                      <Pin aria-hidden="true" className="size-3" />
                      เด่น
                    </span>
                  ) : null}
                  {guide.tags.slice(0, 1).map((tag) => (
                    <span
                      className="rounded-full bg-[var(--site-surface)]/95 px-3 py-1 text-xs font-semibold text-[var(--site-primary)] backdrop-blur"
                      key={tag}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="p-6">
                <h2 className="line-clamp-2 text-xl font-semibold leading-7 text-[var(--site-text)]">
                  {guide.title}
                </h2>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--site-muted)]">
                  {guide.excerpt}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--site-primary)]">
                  อ่านบทความ <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </span>
              </div>
            </a>
          );
        })}
      </ScrollRail>
    </section>
  );
}
