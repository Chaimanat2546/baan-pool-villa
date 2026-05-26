"use client";

import { AlertCircle, RotateCcw, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  filterVillas,
  filterVillasById,
  filtersFromSearchParams,
  getDefaultFilters,
  getMaxVillaPrice,
  getUniqueZones,
  normalizeFiltersForSearch,
  sortVillas,
} from "@/lib/villas/filters";
import { AMENITY_OPTIONS } from "@/lib/villas/amenities";
import type { VillaFilters, VillaListing } from "@/lib/villas/types";
import type { VillaSortKey } from "@/lib/villas/filters";

import { MobileFilterDrawer } from "./mobile-filter-drawer";
import { SearchBar } from "./search-bar";
import { VillaGrid } from "../listing/villa-grid";

type HousesResponse = {
  items: VillaListing[];
};

const PAGE_SIZE = 12;

const SORT_OPTIONS: Array<{ label: string; value: VillaSortKey }> = [
  { label: "แนะนำ", value: "recommended" },
  { label: "ราคา ต่ำ-สูง", value: "price_asc" },
  { label: "ราคา สูง-ต่ำ", value: "price_desc" },
  { label: "จำนวนคน มาก-น้อย", value: "people_desc" },
  { label: "ห้องนอน มาก-น้อย", value: "bedrooms_desc" },
];

function isVillaSortKey(value: string | null): value is VillaSortKey {
  return SORT_OPTIONS.some((option) => option.value === value);
}

function getSearchConditionLabels(
  filters: VillaFilters,
  zones: Array<{ value: string; label: string }>,
): string[] {
  const zoneLabel =
    filters.zone === "all"
      ? "ทุกทำเล"
      : zones.find((zone) => zone.value === filters.zone)?.label ?? filters.zone;

  return [
    zoneLabel,
    `ผู้เข้าพัก ${filters.guests.toLocaleString("th-TH")} คน`,
    `ห้องนอน ${filters.bedrooms.toLocaleString("th-TH")} ห้อง`,
    `ราคาไม่เกิน ${filters.maxPrice.toLocaleString("th-TH")} บาท`,
    ...filters.amenities.map((amenity) => {
      const label = AMENITY_OPTIONS.find((option) => option.key === amenity)?.label ?? amenity;
      return `สิ่งอำนวยความสะดวก: ${label}`;
    }),
  ];
}

export function SearchPage() {
  const searchParams = useSearchParams();
  const [villas, setVillas] = useState<VillaListing[]>([]);
  const [filters, setFilters] = useState<VillaFilters>(() =>
    getDefaultFilters(1000),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<VillaSortKey>("recommended");
  const [villaIdQuery, setVillaIdQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadVillas() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/houses");

        if (!response.ok) {
          throw new Error("ไม่สามารถโหลดข้อมูลบ้านพักได้");
        }

        const payload = (await response.json()) as HousesResponse;
        const items = Array.isArray(payload.items) ? payload.items : [];

        if (!isActive) {
          return;
        }

        const nextMaxPrice = Math.max(getMaxVillaPrice(items), 1000);
        setVillas(items);
        setFilters(filtersFromSearchParams(searchParams, nextMaxPrice));
        const requestedSortKey = searchParams.get("sort");

        setVillaIdQuery(searchParams.get("id") ?? "");
        setSortKey(isVillaSortKey(requestedSortKey) ? requestedSortKey : "recommended");
        setVisibleCount(PAGE_SIZE);
      } catch (caughtError) {
        if (!isActive) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "เกิดข้อผิดพลาดในการโหลดข้อมูล",
        );
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
  }, [searchParams]);

  const maxAvailablePrice = useMemo(() => getMaxVillaPrice(villas), [villas]);
  const zones = useMemo(() => getUniqueZones(villas), [villas]);
  const filteredVillas = useMemo(
    () => sortVillas(filterVillasById(filterVillas(villas, filters), villaIdQuery), sortKey),
    [villas, filters, villaIdQuery, sortKey],
  );
  const visibleVillas = useMemo(
    () => filteredVillas.slice(0, visibleCount),
    [filteredVillas, visibleCount],
  );
  const searchConditionLabels = useMemo(
    () => {
      const labels = getSearchConditionLabels(filters, zones);
      const sortLabel = SORT_OPTIONS.find((option) => option.value === sortKey)?.label;

      if (villaIdQuery.trim()) {
        labels.push(`รหัสบ้าน ${villaIdQuery.trim()}`);
      }

      if (sortKey !== "recommended" && sortLabel) {
        labels.push(`เรียง: ${sortLabel}`);
      }

      return labels;
    },
    [filters, zones, villaIdQuery, sortKey],
  );
  const isSearchReady = !isLoading && villas.length > 0;

  function handleSearch() {
    setFilters((currentFilters) =>
      normalizeFiltersForSearch(currentFilters, maxAvailablePrice),
    );
    setVisibleCount(PAGE_SIZE);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleFilterChange(nextFilters: VillaFilters) {
    setFilters(normalizeFiltersForSearch(nextFilters, maxAvailablePrice));
    setVisibleCount(PAGE_SIZE);
  }

  function handleApplyMobileFilters(nextFilters: VillaFilters) {
    handleFilterChange(nextFilters);
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function showMoreResults() {
    setVisibleCount((current) => current + PAGE_SIZE);
  }

  function handleVillaIdQueryChange(value: string) {
    setVillaIdQuery(value);
    setVisibleCount(PAGE_SIZE);
  }

  function handleSortKeyChange(value: string) {
    setSortKey(isVillaSortKey(value) ? value : "recommended");
    setVisibleCount(PAGE_SIZE);
  }

  function clearSearchConditions() {
    setFilters(getDefaultFilters(Math.max(maxAvailablePrice, 1000)));
    setVillaIdQuery("");
    setSortKey("recommended");
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <main className="min-h-screen px-4 py-5 text-[#063f35] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4 py-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#0f5a66]">
              Baan Pool Villa
            </p>
            <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight text-[#063f35] sm:text-4xl">
              ค้นหาพูลวิลล่าที่ตรงใจในพัทยา
            </h1>
          </div>
          <p className="max-w-sm text-sm leading-6 text-[#55746b]">
            เลือกทำเล จำนวนผู้เข้าพัก ห้องนอน สิ่งอำนวยความสะดวก และงบประมาณที่ต้องการ
          </p>
        </header>

        {isSearchReady ? (
          <div className="grid gap-3 rounded-2xl border border-[#dbe7e3] bg-white p-4 shadow-[0_10px_28px_rgba(6,63,53,0.05)] md:grid-cols-[minmax(0,1fr)_260px]">
            <label className="block min-w-0">
              <span className="text-sm font-bold text-[#064e3b]">ค้นหาด้วยรหัสบ้าน</span>
              <span className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-[#dbe7e3] bg-[#fbfdfb] px-3 text-[#064e3b]">
                <Search className="h-4 w-4 shrink-0 text-[#0f5a66]" />
                <input
                  type="search"
                  value={villaIdQuery}
                  onChange={(event) => handleVillaIdQueryChange(event.target.value)}
                  placeholder="เช่น 9 หรือ DV-9"
                  className="w-full min-w-0 bg-transparent text-sm font-semibold outline-none placeholder:text-[#8aa099]"
                />
              </span>
            </label>

            <label className="block min-w-0">
              <span className="text-sm font-bold text-[#064e3b]">เรียงลำดับ</span>
              <select
                value={sortKey}
                onChange={(event) => handleSortKeyChange(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-[#dbe7e3] bg-[#fbfdfb] px-3 text-sm font-bold text-[#064e3b] outline-none"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {isSearchReady ? (
          <div className="lg:hidden">
            <MobileFilterDrawer
              filters={filters}
              zones={zones}
              maxAvailablePrice={maxAvailablePrice}
              resultCount={filteredVillas.length}
              onApply={handleApplyMobileFilters}
            />
          </div>
        ) : null}

        {isSearchReady ? (
          <div className="hidden lg:block">
            <SearchBar
              filters={filters}
              zones={zones}
              maxAvailablePrice={maxAvailablePrice}
              onChange={handleFilterChange}
              onSearch={handleSearch}
            />
          </div>
        ) : null}

        <section ref={resultsRef} className="scroll-mt-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#55746b]">รายการบ้านพัก</p>
              <h2 className="text-2xl font-black text-[#063f35]">
                พบ {filteredVillas.length.toLocaleString("th-TH")} หลัง
              </h2>
              {!isLoading && filteredVillas.length > 0 ? (
                <p className="mt-1 text-sm font-semibold text-[#55746b]">
                  แสดง {visibleVillas.length.toLocaleString("th-TH")} จาก{" "}
                  {filteredVillas.length.toLocaleString("th-TH")} หลัง
                </p>
              ) : null}
            </div>
          </div>

          {isSearchReady ? (
            <div className="mb-5 rounded-2xl border border-[#dbe7e3] bg-white p-4 shadow-[0_10px_28px_rgba(6,63,53,0.05)]">
              <p className="text-xs font-black uppercase text-[#0f5a66]">เงื่อนไขที่ใช้ค้นหา</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {searchConditionLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-[#dbe7e3] bg-[#f8fbf7] px-3 py-1.5 text-xs font-semibold text-[#064e3b]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-[22px] border border-[#dbe7e3] bg-white shadow-[0_14px_42px_rgba(6,63,53,0.07)]"
                >
                  <Skeleton className="aspect-[4/3] rounded-none bg-[#e6efeb]" />
                  <div className="flex flex-col gap-4 p-5">
                    <Skeleton className="h-5 w-2/3 bg-[#e6efeb]" />
                    <Skeleton className="h-4 w-4/5 bg-[#e6efeb]" />
                    <div className="grid grid-cols-3 gap-2">
                      <Skeleton className="h-10 rounded-xl bg-[#eef5f1]" />
                      <Skeleton className="h-10 rounded-xl bg-[#eef5f1]" />
                      <Skeleton className="h-10 rounded-xl bg-[#eef5f1]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex min-h-72 items-center justify-center rounded-[24px] border border-[#f2d2c9] bg-white px-6 text-center">
              <div className="max-w-md">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#fff2ed] text-[#b64b2f]">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-[#063f35]">
                  โหลดข้อมูลไม่สำเร็จ
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#55746b]">{error}</p>
              </div>
            </div>
          ) : filteredVillas.length === 0 ? (
            <div className="flex min-h-80 items-center justify-center rounded-[24px] border border-[#dbe7e3] bg-white px-6 text-center shadow-[0_14px_42px_rgba(6,63,53,0.06)]">
              <div className="max-w-md">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#eef7f3] text-[#064e3b]">
                  <Search className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-2xl font-black text-[#063f35]">
                  ไม่พบบ้านพักที่ตรงกับเงื่อนไข
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#55746b]">
                  ลองล้างตัวกรอง หรือปรับรหัสบ้าน ราคา จำนวนคน และห้องนอนใหม่อีกครั้ง
                </p>
                <button
                  type="button"
                  onClick={clearSearchConditions}
                  className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#064e3b] px-5 text-sm font-black text-white shadow-[0_14px_34px_rgba(6,78,59,0.18)] transition hover:bg-[#04382d]"
                >
                  <RotateCcw className="h-4 w-4" />
                  ล้างตัวกรอง
                </button>
              </div>
            </div>
          ) : (
            <>
              <VillaGrid villas={visibleVillas} />
              {visibleVillas.length < filteredVillas.length ? (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    className="inline-flex h-12 items-center justify-center rounded-full bg-[#064e3b] px-6 text-sm font-black text-white shadow-[0_14px_34px_rgba(6,78,59,0.18)] transition hover:bg-[#04382d]"
                    onClick={showMoreResults}
                  >
                    ดูเพิ่มเติมอีก{" "}
                    {Math.min(
                      PAGE_SIZE,
                      filteredVillas.length - visibleVillas.length,
                    ).toLocaleString("th-TH")}{" "}
                    หลัง
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
