"use client";

import { AlertCircle, RotateCcw, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SearchPageInitialMeta } from "@/components/villas/search/page-data";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { AMENITY_OPTIONS } from "@/lib/villas/amenities";
import {
  filterVillas,
  filterVillasById,
  filtersFromSearchParams,
  getDefaultFilters,
  getMaxVillaPrice,
  getUniqueZones,
  normalizeFiltersForSearch,
  sortVillas,
  type VillaSortKey,
} from "@/lib/villas/filters";
import type { VillaFilters, VillaListing } from "@/lib/villas/types";

import { VillaGrid } from "../listing/villa-grid";
import { MobileFilterDrawer } from "./mobile-filter-drawer";
import { SearchBar } from "./search-bar";

interface SearchPageProps {
  initialLoadError?: string | null;
  initialSearchParams?: string;
  initialVillas?: VillaListing[];
  initialMeta?: SearchPageInitialMeta;
}

const PAGE_SIZE = 12;

function getSearchErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "ไม่สามารถโหลดข้อมูลบ้านพักได้ กรุณาลองใหม่อีกครั้ง";
  }

  const message = error.message.trim().toLowerCase();

  if (
    message.startsWith("unable to load houses") ||
    message === "invalid house list payload"
  ) {
    return "ไม่สามารถโหลดข้อมูลบ้านพักได้ กรุณาลองใหม่อีกครั้ง";
  }

  return error.message;
}
const CATALOG_HYDRATION_SEARCH_PARAMS = [
  "amenities",
  "bedrooms",
  "guests",
  "id",
  "maxPrice",
  "nearSea",
  "sort",
  "zone",
];

const SORT_OPTIONS: { label: string; value: VillaSortKey }[] = [
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
  zones: { value: string; label: string }[],
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
    ...(filters.nearSeaOnly ? ["บ้านพักใกล้ทะเลไม่เกิน 2 กม."] : []),
    ...filters.amenities.map((amenity) => {
      const label =
        AMENITY_OPTIONS.find((option) => option.key === amenity)?.label ??
        amenity;
      return `สิ่งอำนวยความสะดวก: ${label}`;
    }),
  ];
}

function hasCatalogHydrationSearchParams(searchParams: URLSearchParams): boolean {
  return CATALOG_HYDRATION_SEARCH_PARAMS.some((key) => searchParams.has(key));
}

interface SearchCatalogApiResponse {
  error?: string;
  items?: VillaListing[];
}

export function getInitialCatalogComplete(
  initialMeta: SearchPageInitialMeta | undefined,
): boolean {
  return initialMeta?.catalogComplete ?? true;
}

export function SearchPage({
  initialLoadError = null,
  initialSearchParams,
  initialVillas = [],
  initialMeta,
}: SearchPageProps) {
  const browserSearchParams = useSearchParams();
  const resolvedInitialSearchParams =
    initialSearchParams ?? browserSearchParams.toString();
  const resolvedMeta = useMemo(() => {
    const fallbackZones = getUniqueZones(initialVillas);
    const fallbackMaxPrice = Math.max(getMaxVillaPrice(initialVillas), 1000);

    return {
      maxPrice: Math.max(initialMeta?.maxPrice ?? fallbackMaxPrice, 1000),
      resultCount: initialMeta?.resultCount ?? initialVillas.length,
      zones: initialMeta?.zones?.length ? initialMeta.zones : fallbackZones,
    };
  }, [initialMeta, initialVillas]);

  const searchParams = useMemo(
    () => new URLSearchParams(resolvedInitialSearchParams),
    [resolvedInitialSearchParams],
  );
  const shouldHydrateCatalogForDeepLink = useMemo(
    () => hasCatalogHydrationSearchParams(searchParams),
    [searchParams],
  );
  const [villas, setVillas] = useState<VillaListing[]>(() => initialVillas);
  const pendingVillaIdQuery = useRef<string | null>(null);
  const [isCatalogComplete, setIsCatalogComplete] = useState(
    getInitialCatalogComplete(initialMeta),
  );
  const [isCatalogHydrating, setIsCatalogHydrating] = useState(false);
  const [error, setError] = useState<string | null>(
    initialLoadError ? getSearchErrorMessage(new Error(initialLoadError)) : null,
  );
  const [filters, setFilters] = useState<VillaFilters>(() =>
    filtersFromSearchParams(searchParams, resolvedMeta.maxPrice),
  );
  const [sortKey, setSortKey] = useState<VillaSortKey>(() => {
    const requestedSortKey = searchParams.get("sort");

    return isVillaSortKey(requestedSortKey) ? requestedSortKey : "recommended";
  });
  const [villaIdQuery, setVillaIdQuery] = useState(
    () => searchParams.get("id") ?? "",
  );
  const [villaIdInput, setVillaIdInput] = useState(
    () => searchParams.get("id") ?? "",
  );
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const pendingHydration = useRef<Promise<boolean> | null>(null);

  const maxAvailablePrice = resolvedMeta.maxPrice;
  const zones = useMemo(() => resolvedMeta.zones, [resolvedMeta.zones]);

  const filteredVillas = useMemo(() => {
    if (!isCatalogComplete && isCatalogHydrating) {
      return [];
    }

    return sortVillas(
      filterVillasById(filterVillas(villas, filters), villaIdQuery),
      sortKey,
    );
  }, [isCatalogComplete, isCatalogHydrating, villas, filters, villaIdQuery, sortKey]);
  const visibleVillas = useMemo(
    () => filteredVillas.slice(0, visibleCount),
    [filteredVillas, visibleCount],
  );
  const resultCount = isCatalogComplete ? filteredVillas.length : resolvedMeta.resultCount;
  const canLoadMore = visibleVillas.length < resultCount;
  const searchConditionLabels = useMemo(() => {
    const labels = getSearchConditionLabels(filters, zones);
    const sortLabel = SORT_OPTIONS.find((option) => option.value === sortKey)?.label;

    if (villaIdQuery.trim()) {
      labels.push(`รหัสบ้าน ${villaIdQuery.trim()}`);
    }

    if (sortKey !== "recommended" && sortLabel) {
      labels.push(`เรียง: ${sortLabel}`);
    }

    return labels;
  }, [filters, zones, villaIdQuery, sortKey]);
  const isSearchReady =
    villas.length > 0 ||
    !getInitialCatalogComplete(initialMeta) ||
    resolvedMeta.zones.length > 0;

  const hydrateCatalog = useCallback(async () => {
    if (isCatalogComplete) {
      return true;
    }

    if (pendingHydration.current) {
      return pendingHydration.current;
    }

    setIsCatalogHydrating(true);

    const hydration = (async () => {
      try {
        const response = await fetch("/api/houses");

        if (!response.ok) {
          throw new Error(`Unable to load houses (${response.status})`);
        }

        const payload = (await response.json()) as SearchCatalogApiResponse;

        if (!Array.isArray(payload.items)) {
          throw new Error(payload.error ?? "Invalid house list payload");
        }

        setVillas(payload.items);
        setIsCatalogComplete(true);
        setError(null);
        return true;
      } catch (hydrateError) {
        setError(getSearchErrorMessage(hydrateError));

        return false;
      } finally {
        setIsCatalogHydrating(false);
      }
    })();

    pendingHydration.current = hydration;

    void hydration.finally(() => {
      if (pendingHydration.current === hydration) {
        pendingHydration.current = null;
      }
    });

    return hydration;
  }, [isCatalogComplete]);

  useEffect(() => {
    if (isCatalogComplete && pendingVillaIdQuery.current !== null) {
      setVillaIdQuery(pendingVillaIdQuery.current);
      pendingVillaIdQuery.current = null;
      setVisibleCount(PAGE_SIZE);
    }
  }, [isCatalogComplete]);

  useEffect(() => {
    if (!isCatalogComplete && shouldHydrateCatalogForDeepLink) {
      void hydrateCatalog();
    }
  }, [hydrateCatalog, isCatalogComplete, shouldHydrateCatalogForDeepLink]);

  function handleSearch() {
    if (!isCatalogComplete) {
      void hydrateCatalog();
    }

    setFilters((currentFilters) =>
      normalizeFiltersForSearch(currentFilters, maxAvailablePrice),
    );
    setVisibleCount(PAGE_SIZE);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleFilterChange(nextFilters: VillaFilters) {
    setFilters(normalizeFiltersForSearch(nextFilters, maxAvailablePrice));
    if (!isCatalogComplete) {
      void hydrateCatalog();
    }
    setVisibleCount(PAGE_SIZE);
  }

  function handleApplyMobileFilters(nextFilters: VillaFilters) {
    handleFilterChange(nextFilters);
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function showMoreResults() {
    if (!isCatalogComplete) {
      void hydrateCatalog();
    }

    setVisibleCount((current) => current + PAGE_SIZE);
  }

  function handleVillaIdQueryChange(value: string) {
    setVillaIdInput(value);

    if (!isCatalogComplete) {
      pendingVillaIdQuery.current = value;
      void hydrateCatalog();
      return;
    }

    setVillaIdQuery(value);
    setVisibleCount(PAGE_SIZE);
  }

  function handleSortKeyChange(value: string) {
    if (!isCatalogComplete) {
      void hydrateCatalog();
    }

    setSortKey(isVillaSortKey(value) ? value : "recommended");
    setVisibleCount(PAGE_SIZE);
  }

  function clearSearchConditions() {
    if (!isCatalogComplete) {
      void hydrateCatalog();
    }

    setFilters(getDefaultFilters(Math.max(maxAvailablePrice, 1000)));
    setVillaIdInput("");
    setVillaIdQuery("");
    pendingVillaIdQuery.current = null;
    setSortKey("recommended");
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <main className="min-h-screen bg-[var(--site-surface-soft)] px-4 py-5 text-[var(--site-text)] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4 py-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--site-accent)]">
              Baan Pool Villa
            </p>
            <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight text-[var(--site-text)] sm:text-4xl">
              ค้นหาพูลวิลล่าที่ตรงใจในพัทยา
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--site-muted)]">
              รวมบ้านพักพูลวิลล่าพัทยาสำหรับครอบครัว กลุ่มเพื่อน และทริปปาร์ตี้
              พร้อมตัวกรองทำเล จำนวนคน ห้องนอน ราคา และรหัสบ้าน
            </p>
            <nav
              aria-label="ลิงก์ที่เกี่ยวข้องกับการค้นหาบ้านพัก"
              className="mt-4 flex flex-wrap gap-2 text-sm font-bold"
            >
              <Link
                className="rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-1.5 text-[var(--site-primary)] transition hover:border-[var(--site-border-strong)]"
                href="/"
                prefetch={false}
              >
                หน้าแรก
              </Link>
              <Link
                className="rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-1.5 text-[var(--site-primary)] transition hover:border-[var(--site-border-strong)]"
                href="/guides"
                prefetch={false}
              >
                อ่านคู่มือเลือกบ้านพัก
              </Link>
            </nav>
          </div>
          <p className="max-w-sm text-sm leading-6 text-[var(--site-muted)]">
            เลือกทำเล จำนวนผู้เข้าพัก ห้องนอน สิ่งอำนวยความสะดวก และงบประมาณที่ต้องการ
          </p>
        </header>

        {isSearchReady ? (
          <div className="grid gap-3 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-[0_10px_28px_rgba(6,63,53,0.05)] md:grid-cols-[minmax(0,1fr)_260px]">
            <label className="block min-w-0">
              <span className="text-sm font-bold text-[var(--site-text)]">ค้นหาด้วยรหัสบ้าน</span>
              <span className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 text-[var(--site-text)]">
                <Search className="h-4 w-4 shrink-0 text-[var(--site-primary)]" />
                <input
                  type="search"
                  value={villaIdInput}
                  onChange={(event) => {
                    handleVillaIdQueryChange(event.target.value);
                  }}
                  placeholder="เช่น 9 หรือ DV-9"
                  className="w-full min-w-0 bg-transparent text-sm font-semibold outline-none placeholder:text-[var(--site-muted)]"
                />
              </span>
            </label>

            <div className="block min-w-0">
              <span className="text-sm font-bold text-[var(--site-text)]">เรียงลำดับ</span>
              <DropdownSelect
                ariaLabel="เรียงลำดับบ้านพัก"
                options={SORT_OPTIONS}
                value={sortKey}
                onChange={handleSortKeyChange}
              />
            </div>
          </div>
        ) : null}

        {isSearchReady ? (
          <div className="lg:hidden">
            <MobileFilterDrawer
              filters={filters}
              zones={zones}
              maxAvailablePrice={maxAvailablePrice}
              resultCount={resultCount}
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
              <p className="text-sm font-semibold text-[var(--site-muted)]">รายการบ้านพัก</p>
              <h2 className="text-2xl font-black text-[var(--site-text)]">
                พบ {resultCount.toLocaleString("th-TH")} หลัง
              </h2>
              {filteredVillas.length > 0 ? (
                <p className="mt-1 text-sm font-semibold text-[var(--site-muted)]">
                  แสดง {visibleVillas.length.toLocaleString("th-TH")} จาก{" "}
                  {resultCount.toLocaleString("th-TH")} หลัง
                </p>
              ) : null}
            </div>
          </div>

          {isSearchReady ? (
            <div className="mb-5 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-[0_10px_28px_rgba(6,63,53,0.05)]">
              <p className="text-xs font-black uppercase text-[var(--site-accent)]">เงื่อนไขที่ใช้ค้นหา</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {searchConditionLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--site-text)]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="flex min-h-72 items-center justify-center rounded-[24px] border border-[var(--site-border)] bg-[var(--site-surface)] px-6 text-center">
              <div className="max-w-md">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--site-accent-soft)] text-[var(--site-accent)]">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-[var(--site-text)]">
                  โหลดข้อมูลไม่สำเร็จ
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--site-muted)]">{error}</p>
              </div>
            </div>
          ) : isCatalogHydrating && !isCatalogComplete ? (
            <div className="flex min-h-80 items-center justify-center rounded-[24px] border border-[var(--site-border)] bg-[var(--site-surface)] px-6 text-center">
              <div className="max-w-md">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
                  <Search className="h-6 w-6 animate-pulse" />
                </div>
                <h2 className="mt-4 text-2xl font-black text-[var(--site-text)]">
                  กำลังโหลดรายชื่อบ้านพักเพิ่มเติม
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--site-muted)]">
                  กรุณารอสักครู่เพื่อคำนวณผลลัพธ์ล่าสุด
                </p>
              </div>
            </div>
          ) : filteredVillas.length === 0 ? (
            <div className="flex min-h-80 items-center justify-center rounded-[24px] border border-[var(--site-border)] bg-[var(--site-surface)] px-6 text-center shadow-[0_14px_42px_rgba(6,63,53,0.06)]">
              <div className="max-w-md">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
                  <Search className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-2xl font-black text-[var(--site-text)]">
                  ไม่พบบ้านพักที่ตรงกับเงื่อนไข
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--site-muted)]">
                  ลองล้างตัวกรอง หรือปรับรหัสบ้าน ราคา จำนวนคน และห้องนอนใหม่อีกครั้ง
                </p>
                <button
                  type="button"
                  onClick={clearSearchConditions}
                  className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--site-primary)] px-5 text-sm font-black text-[var(--site-on-primary)] shadow-[0_14px_34px_rgba(6,78,59,0.18)] transition hover:bg-[var(--site-primary-hover)]"
                >
                  <RotateCcw className="h-4 w-4" />
                  ล้างตัวกรอง
                </button>
              </div>
            </div>
          ) : (
            <>
              <VillaGrid villas={visibleVillas} />
              {canLoadMore ? (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--site-primary)] px-6 text-sm font-black text-[var(--site-on-primary)] shadow-[0_14px_34px_rgba(6,78,59,0.18)] transition hover:bg-[var(--site-primary-hover)]"
                    onClick={showMoreResults}
                  >
                    ดูเพิ่มเติมอีก{" "}
                    {Math.min(PAGE_SIZE, resultCount - visibleVillas.length).toLocaleString(
                      "th-TH",
                    )}{" "}
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
