"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ScrollRail } from "@/components/ui/scroll-rail";
import type { PublicRecommendedVillaSection } from "@/lib/villas/public-dto";
import { VillaCard } from "../listing/villa-card";

const DEFAULT_RECOMMENDED_CTA_HREF = "/search";
const DEFERRED_BLOCK_ROOT_MARGIN = "600px 0px";

interface LazyDetailBlockProps {
  children: ReactNode;
  name: string;
}

export function LazyDetailBlock({ children, name }: LazyDetailBlockProps) {
  const [isVisible, setIsVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible) {
      return;
    }

    if (typeof window.IntersectionObserver === "undefined") {
      const timeout = globalThis.setTimeout(() => {
        setIsVisible(true);
      }, 0);

      return () => {
        globalThis.clearTimeout(timeout);
      };
    }

    const root = rootRef.current;

    if (!root) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: DEFERRED_BLOCK_ROOT_MARGIN },
    );

    observer.observe(root);

    return () => {
      observer.disconnect();
    };
  }, [isVisible]);

  return (
    <div ref={rootRef} className="min-h-px" data-lazy-detail-block={name}>
      {isVisible ? children : null}
    </div>
  );
}

interface HomeSectionsResponse {
  sections?: PublicRecommendedVillaSection[];
}

let recommendedSectionPromise: Promise<PublicRecommendedVillaSection | null> | null =
  null;

function pickRecommendedSection(
  data: HomeSectionsResponse,
): PublicRecommendedVillaSection | null {
  return Array.isArray(data.sections)
    ? (data.sections.find((section) => section.villas.length > 0) ?? null)
    : null;
}

function sanitizeRecommendedCtaHref(href: string): string {
  if (href.startsWith("/") && !href.startsWith("//")) {
    return href;
  }

  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : DEFAULT_RECOMMENDED_CTA_HREF;
  } catch {
    return DEFAULT_RECOMMENDED_CTA_HREF;
  }
}

function loadRecommendedSection() {
  recommendedSectionPromise ??= fetch("/api/home-sections")
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Unable to load recommended villas");
      }

      return pickRecommendedSection(
        (await response.json()) as HomeSectionsResponse,
      );
    })
    .catch(() => {
      recommendedSectionPromise = null;
      return null;
    });

  return recommendedSectionPromise;
}

export function DeferredRecommendedVillas() {
  const [recommendedSection, setRecommendedSection] =
    useState<PublicRecommendedVillaSection | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadRecommendedSection()
      .then((section) => {
        if (!cancelled) {
          setRecommendedSection(section);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  if (!recommendedSection) {
    return null;
  }

  const ctaHref = recommendedSection.cta
    ? sanitizeRecommendedCtaHref(recommendedSection.cta.href)
    : null;

  return (
    <div
      className="relative left-1/2 w-screen -translate-x-1/2"
      data-detail-recommended-villas="deferred-rail"
    >
      <section
        id="recommendations"
        className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-14"
      >
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-black text-[var(--site-text)]">
            {recommendedSection.title}
          </h2>
          <p className="mt-3 text-base leading-7 text-[var(--site-muted)]">
            {recommendedSection.description}
          </p>
        </div>
        <ScrollRail
          label={recommendedSection.title}
          className="-mx-4 mt-4 gap-5 px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:gap-6 lg:px-8 lg:py-8"
        >
          {recommendedSection.villas.slice(0, 12).map((villa) => (
            <div key={villa.id} className="w-[290px] shrink-0 snap-start">
              <VillaCard villa={villa} titleHeadingLevel="h3" />
            </div>
          ))}
        </ScrollRail>
        {recommendedSection.cta ? (
          <div className="mt-8 text-center">
            <a
              href={ctaHref ?? DEFAULT_RECOMMENDED_CTA_HREF}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--site-primary)] px-5 py-3 text-sm font-black text-[var(--site-on-primary)] shadow-[0_14px_30px_rgba(6,77,61,0.22)] transition hover:bg-[var(--site-primary-hover)]"
            >
              {recommendedSection.cta.label} <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        ) : null}
      </section>
    </div>
  );
}
