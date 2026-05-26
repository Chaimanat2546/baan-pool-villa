"use client";

import { AlertCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  filterVillas,
  getDefaultFilters,
  getMaxVillaPrice,
  getUniqueZones,
} from "@/lib/villas/filters";
import type { VillaFilters, VillaListing } from "@/lib/villas/types";

import { SearchBar } from "./search-bar";
import { VillaGrid } from "./villa-grid";

type HousesResponse = {
  items: VillaListing[];
};

export function HomePage() {
  const [villas, setVillas] = useState<VillaListing[]>([]);
  const [filters, setFilters] = useState<VillaFilters>(() =>
    getDefaultFilters(1000),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

        setVillas(items);
        setFilters(getDefaultFilters(Math.max(getMaxVillaPrice(items), 1000)));
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
  }, []);

  const maxAvailablePrice = useMemo(() => getMaxVillaPrice(villas), [villas]);
  const zones = useMemo(() => getUniqueZones(villas), [villas]);
  const filteredVillas = useMemo(
    () => filterVillas(villas, filters),
    [villas, filters],
  );

  function handleSearch() {
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

        <SearchBar
          filters={filters}
          zones={zones}
          maxAvailablePrice={maxAvailablePrice}
          onChange={setFilters}
          onSearch={handleSearch}
        />

        <section ref={resultsRef} className="scroll-mt-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#55746b]">รายการบ้านพัก</p>
              <h2 className="text-2xl font-black text-[#063f35]">
                พบ {filteredVillas.length.toLocaleString("th-TH")} หลัง
              </h2>
            </div>
            <div className="rounded-full border border-[#dbe7e3] bg-white px-4 py-2 text-sm font-semibold text-[#55746b]">
              ราคาไม่เกิน{" "}
              <span className="text-[#d88d00]">
                {filters.maxPrice.toLocaleString("th-TH")} บาท
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-[22px] border border-[#dbe7e3] bg-white shadow-[0_14px_42px_rgba(6,63,53,0.07)]"
                >
                  <div className="aspect-[4/3] animate-pulse bg-[#e6efeb]" />
                  <div className="space-y-4 p-5">
                    <div className="h-5 w-2/3 animate-pulse rounded bg-[#e6efeb]" />
                    <div className="h-4 w-4/5 animate-pulse rounded bg-[#e6efeb]" />
                    <div className="grid grid-cols-3 gap-2">
                      <div className="h-10 animate-pulse rounded-xl bg-[#eef5f1]" />
                      <div className="h-10 animate-pulse rounded-xl bg-[#eef5f1]" />
                      <div className="h-10 animate-pulse rounded-xl bg-[#eef5f1]" />
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
          ) : (
            <VillaGrid villas={filteredVillas} />
          )}
        </section>
      </div>
    </main>
  );
}
