"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { VillaFilters } from "@/lib/villas/types";

import { SearchBar } from "./search-bar";

interface ZoneOption {
  label: string;
  value: string;
}

interface MobileFilterDrawerProps {
  filters: VillaFilters;
  maxAvailablePrice: number;
  onApply: (filters: VillaFilters) => void;
  resultCount: number;
  zones: ZoneOption[];
}

function getActiveFilterCount(filters: VillaFilters, maxAvailablePrice: number): number {
  let count = 0;

  if (filters.zone !== "all") count += 1;
  if (filters.guests > 1) count += 1;
  if (filters.bedrooms > 1) count += 1;
  if (filters.amenities.length > 0) count += 1;
  if (filters.maxPrice < maxAvailablePrice) count += 1;
  if (filters.nearSeaOnly) count += 1;

  return count;
}

export function MobileFilterDrawer({
  filters,
  maxAvailablePrice,
  onApply,
  resultCount,
  zones,
}: MobileFilterDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(filters);
  const activeFilterCount = useMemo(
    () => getActiveFilterCount(filters, Math.max(maxAvailablePrice, 1000)),
    [filters, maxAvailablePrice],
  );

  function applyFilters() {
    onApply(draftFilters);
    setIsOpen(false);
  }

  function openDrawer() {
    setDraftFilters(filters);
    setIsOpen(true);
  }

  return (
    <>
      <button
        type="button"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--site-primary)] px-5 text-sm font-semibold text-[var(--site-on-primary)] shadow-[0_14px_34px_rgba(6,78,59,0.18)] transition hover:bg-[var(--site-primary-hover)] lg:hidden"
        onClick={openDrawer}
      >
        <SlidersHorizontal className="h-4 w-4" />
        ตัวกรอง
        {activeFilterCount > 0 ? (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--site-accent)] px-1 text-xs font-bold text-[var(--site-on-accent)]">
            {activeFilterCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="ปิดตัวกรอง"
            className="absolute inset-0 bg-[#021d19]/55"
            onClick={() => {
              setIsOpen(false);
            }}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88svh] overflow-hidden rounded-t-[28px] bg-[var(--site-surface-soft)] shadow-[0_-24px_60px_rgba(2,29,25,0.22)]">
            <div className="flex items-center justify-between border-b border-[var(--site-border)] bg-[var(--site-surface)] px-5 py-4">
              <div>
                <p className="text-xs font-semibold text-[var(--site-muted)]">
                  พบ {resultCount.toLocaleString("th-TH")} หลัง
                </p>
                <h2 className="text-xl font-black text-[var(--site-text)]">ตัวกรองบ้านพัก</h2>
              </div>
              <button
                type="button"
                aria-label="ปิดตัวกรอง"
                className="grid h-10 w-10 place-items-center rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-primary)]"
                onClick={() => {
                  setIsOpen(false);
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(88svh-80px)] overflow-y-auto px-4 pb-5 pt-4">
              <SearchBar
                filters={draftFilters}
                zones={zones}
                maxAvailablePrice={maxAvailablePrice}
                onChange={setDraftFilters}
                onSearch={applyFilters}
                searchLabel="ใช้ตัวกรอง"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
