"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

type HousesResponse = {
  items: VillaListing[];
};

export function HomePage() {
  const router = useRouter();
  const [villas, setVillas] = useState<VillaListing[]>([]);
  const [filters, setFilters] = useState<VillaFilters>(() => getDefaultFilters(1000));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function loadVillas() {
      try {
        setIsLoading(true);

        const response = await fetch("/api/houses");

        if (!response.ok) {
          throw new Error("ไม่สามารถโหลดข้อมูลบ้านพักได้");
        }

        const payload = (await response.json()) as HousesResponse;
        const items = Array.isArray(payload.items) ? payload.items : [];

        if (!isActive) {
          return;
        }

        setVillas(items);
        setFilters(getDefaultFilters(Math.max(getMaxVillaPrice(items), 1000)));
      } catch (caughtError) {
        console.error(caughtError);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadVillas();

    return () => {
      isActive = false;
    };
  }, []);

  const featuredVillas = useMemo(() => villas.slice(0, 12), [villas]);
  const popularVillas = useMemo(() => villas.slice(12, 24), [villas]);
  const maxAvailablePrice = useMemo(() => getMaxVillaPrice(villas), [villas]);
  const zones = useMemo(() => getUniqueZones(villas), [villas]);
  const beachVillas = useMemo(
    () =>
      villas
        .filter((villa) => villa.distanceToSea !== "-")
        .slice(0, 12),
    [villas],
  );

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

        {featuredVillas.length > 0 ? (
          <VillaRail
            cta
            title="บ้านพักแนะนำ"
            description="พูลวิลล่าคัดพิเศษ เหมาะสำหรับครอบครัว กลุ่มเพื่อน และทริปพักผ่อนส่วนตัว"
            villas={featuredVillas}
          />
        ) : null}

        <WhyChooseSection />

        {popularVillas.length > 0 ? (
          <VillaRail
            title="พูลวิลล่าพัทยายอดฮิต"
            description="บ้านพักยอดนิยมสำหรับทริปพัทยา ใกล้แหล่งท่องเที่ยว เดินทางสะดวก และเหมาะกับกลุ่มเพื่อน"
            villas={popularVillas}
          />
        ) : null}

        {beachVillas.length > 0 ? (
          <VillaRail
            title="บ้านพักใกล้ทะเล"
            description="เลือกพูลวิลล่าใกล้ชายหาด เดินทางง่าย เหมาะกับคนที่อยากพักผ่อนใกล้ทะเล"
            villas={beachVillas}
          />
        ) : null}

        <DestinationsSection villas={villas} />
        <ArticlesSection villas={villas} />
        <FaqSection />
        <ContactSection />
      </div>
    </main>
  );
}
