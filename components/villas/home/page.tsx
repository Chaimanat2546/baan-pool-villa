"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";

import { buildFallbackHomeSections } from "@/lib/home-sections/resolve";
import type { ResolvedHomeSection } from "@/lib/home-sections/types";
import {
  filtersToSearchParams,
  getDefaultFilters,
  getMaxVillaPrice,
  getUniqueZones,
  normalizeFiltersForSearch,
} from "@/lib/villas/filters";
import type { VillaFilters, VillaListing } from "@/lib/villas/types";

import { ArticlesSection } from "./articles-section";
import { ContactSection } from "./contact-section";
import { DestinationsSection } from "./destinations-section";
import { FaqSection } from "./faq-section";
import { HeroSection } from "./hero-section";
import { LoadingSkeleton } from "./loading-skeleton";
import { VillaRail } from "./villa-rail";
import { WhyChooseSection } from "./why-choose-section";

interface HousesResponse {
  items: VillaListing[];
};

interface HomeSectionsResponse {
  sections?: unknown;
};

function isResolvedHomeSection(value: unknown): value is ResolvedHomeSection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const section = value as Partial<ResolvedHomeSection>;

  return (
    typeof section.slug === "string" &&
    typeof section.title === "string" &&
    typeof section.description === "string" &&
    Array.isArray(section.villas) &&
    section.villas.length > 0
  );
}

export function HomePage() {
  const router = useRouter();
  const [villas, setVillas] = useState<VillaListing[]>([]);
  const [homeSections, setHomeSections] = useState<ResolvedHomeSection[]>([]);
  const [filters, setFilters] = useState<VillaFilters>(() => getDefaultFilters(1000));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function loadVillas() {
      try {
        setIsLoading(true);

        const [housesResponse, homeSectionsResponse] = await Promise.all([
          fetch("/api/houses"),
          fetch("/api/home-sections").catch(() => null),
        ]);

        if (!housesResponse.ok) {
          throw new Error("ไม่สามารถโหลดข้อมูลบ้านพักได้");
        }

        const payload = (await housesResponse.json()) as HousesResponse;
        const items = Array.isArray(payload.items) ? payload.items : [];
        let resolvedHomeSections = buildFallbackHomeSections(items);

        if (homeSectionsResponse?.ok) {
          try {
            const homeSectionsPayload =
              (await homeSectionsResponse.json()) as HomeSectionsResponse;
            const configuredSections = Array.isArray(homeSectionsPayload.sections)
              ? homeSectionsPayload.sections.filter(isResolvedHomeSection)
              : [];

            if (configuredSections.length > 0) {
              resolvedHomeSections = configuredSections;
            }
          } catch (caughtError) {
            console.error(caughtError);
          }
        }

        if (!isActive) {
          return;
        }

        setVillas(items);
        setHomeSections(resolvedHomeSections);
        setFilters(getDefaultFilters(Math.max(getMaxVillaPrice(items), 1000)));
      } catch (caughtError) {
        console.error(caughtError);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadVillas();

    return () => {
      isActive = false;
    };
  }, []);

  const maxAvailablePrice = useMemo(() => getMaxVillaPrice(villas), [villas]);
  const zones = useMemo(() => getUniqueZones(villas), [villas]);
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

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fbfdfb] text-[#063f35]">
      <HeroSection
        filters={filters}
        zones={zones}
        maxAvailablePrice={maxAvailablePrice}
        onChange={setFilters}
        onSearch={handleHeroSearch}
      />

      <div className="pt-0 lg:pt-20">
        {isLoading ? <LoadingSkeleton /> : null}

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

        <DestinationsSection villas={villas} />
        <ArticlesSection villas={villas} />
        <FaqSection />
        <ContactSection />
      </div>
    </main>
  );
}
