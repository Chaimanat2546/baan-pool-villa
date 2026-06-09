"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";

import type { GuidePost } from "@/lib/guides/types";
import type { ResolvedHomeSection } from "@/lib/home-sections/types";
import type { SiteSettings } from "@/lib/site-settings/types";
import {
  filtersToSearchParams,
  getDefaultFilters,
  normalizeFiltersForSearch,
} from "@/lib/villas/filters";
import type { VillaFilters } from "@/lib/villas/types";

import { ArticlesSection } from "./articles-section";
import { ContactSection } from "./contact-section";
import { DestinationsSection } from "./destinations-section";
import { FaqSection } from "./faq-section";
import { HeroSection } from "./hero-section";
import { VillaRail } from "./villa-rail";
import { WhyChooseSection } from "./why-choose-section";
import { TikTokSection } from "./tiktok-section";

type FilterSummary = {
  maxAvailablePrice: number;
  zones: Array<{ value: string; label: string }>;
};

type DestinationVilla = {
  coverImage: string | null;
};

export interface HomePageDegradedSources {
  guidePosts: boolean;
  homeSections: boolean;
  siteSettings: boolean;
  villaCatalog: boolean;
}

interface HomePageProps {
  degradedSources?: HomePageDegradedSources;
  initialGuides?: GuidePost[];
  initialHomeSections?: ResolvedHomeSection[];
  filterSummary?: FilterSummary;
  destinationVillas?: DestinationVilla[];
  settings: SiteSettings;
}

/**
 * Render the site's homepage with hero, villa rails, and supporting content sections.
 *
 * Renders a HeroSection (driving search filters), a sequence of VillaRail sections when available
 * (inserting WhyChooseSection after the first rail), and the Destinations, TikTok, Articles,
 * FAQ, and Contact sections.
 *
 * @param initialGuides - Optional initial list of guide articles used to populate the ArticlesSection
 * @param initialHomeSections - Optional initial home sections used to build villa rails
 * @param filterSummary - Optional precomputed filter summary used to initialize hero filter defaults and price/zone controls
 * @param destinationVillas - Optional minimal villa records for destination cards
 * @param settings - Required site settings (visual assets, contact info, default TikTok settings, etc.)
 * @returns The React element tree for the homepage
 */
export function HomePage({
  degradedSources,
  initialGuides = [],
  initialHomeSections = [],
  filterSummary,
  destinationVillas = [],
  settings,
}: HomePageProps) {
  const maxAvailablePrice = filterSummary?.maxAvailablePrice ?? 0;
  const zones = filterSummary?.zones ?? [];
  const router = useRouter();
  const [guides] = useState<GuidePost[]>(() => initialGuides);
  const [homeSections] = useState<ResolvedHomeSection[]>(
    () => initialHomeSections,
  );
  const [filters, setFilters] = useState<VillaFilters>(() =>
    getDefaultFilters(Math.max(maxAvailablePrice, 1000)),
  );

  const railSections = homeSections.filter((section) => section.villas.length > 0);

  function handleHeroSearch() {
    const shouldOmitPlaceholderPrice =
      maxAvailablePrice <= 1000 && filters.maxPrice <= 1000;
    const params = filtersToSearchParams(
      normalizeFiltersForSearch(filters, maxAvailablePrice),
      { omitMaxPrice: shouldOmitPlaceholderPrice },
    );
    const query = params.toString();

    router.push(query ? `/search?${query}` : "/search");
  }

  const degradedSourceNames = [
    degradedSources?.siteSettings ? "siteSettings" : null,
    degradedSources?.guidePosts ? "guidePosts" : null,
    degradedSources?.villaCatalog ? "villaCatalog" : null,
    degradedSources?.homeSections ? "homeSections" : null,
  ].filter((source): source is string => source !== null);

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-[var(--site-surface-soft)] text-[var(--site-text)]"
      data-home-degraded={degradedSourceNames.length > 0 ? "true" : undefined}
      data-home-degraded-sources={
        degradedSourceNames.length > 0 ? degradedSourceNames.join(",") : undefined
      }
    >
      <HeroSection
        filters={filters}
        heroImage={settings.heroImage}
        zones={zones}
        maxAvailablePrice={maxAvailablePrice}
        onChange={setFilters}
        onSearch={handleHeroSearch}
      />

      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--site-accent)]">
              Baan Pool Villa Pattaya
            </p>
            <h1 className="mt-2 text-3xl font-black leading-tight text-[var(--site-text)] sm:text-4xl">
              บ้านพักพูลวิลล่าพัทยาสำหรับครอบครัว กลุ่มเพื่อน และทริปปาร์ตี้
            </h1>
            <p className="mt-3 text-sm leading-7 text-[var(--site-muted)] sm:text-base">
              เลือกบ้านพักจากทำเล จำนวนผู้เข้าพัก ห้องนอน ราคา และบ้านใกล้ทะเล
              พร้อมดูบทความช่วยวางแผนก่อนจอง
            </p>
          </div>
          <nav
            aria-label="ลิงก์หลักสำหรับค้นหาบ้านพัก"
            className="flex flex-wrap gap-2 text-sm font-bold"
          >
            <Link
              className="rounded-full bg-[var(--site-primary)] px-4 py-2 text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)]"
              href="/search"
              prefetch={false}
            >
              ค้นหาบ้านพัก
            </Link>
            <Link
              className="rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-2 text-[var(--site-primary)] transition hover:border-[var(--site-border-strong)]"
              href="/guides"
              prefetch={false}
            >
              อ่านคู่มือเลือกพูลวิลล่า
            </Link>
          </nav>
        </div>
      </section>

      <div>
        {railSections.length > 0 ? (
          railSections.map((section, index) => (
            <Fragment key={section.slug}>
              <VillaRail
                cta={section.cta}
                id={section.slug}
                title={section.title}
                description={section.description}
                villas={section.villas}
              />
              {index === 0 ? <WhyChooseSection /> : null}
            </Fragment>
          ))
        ) : (
          <WhyChooseSection />
        )}

        <DestinationsSection villas={destinationVillas} />
        <TikTokSection tiktok={settings.tiktok} />
        <ArticlesSection guides={guides} />
        <FaqSection />
        <ContactSection settings={settings} />
      </div>
    </main>
  );
}
