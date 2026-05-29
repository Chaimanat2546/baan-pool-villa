"use client";

import {
  BedDouble,
  Check,
  ChevronDown,
  MapPin,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { AMENITY_OPTIONS } from "@/lib/villas/amenities";
import type { AmenityKey, VillaFilters } from "@/lib/villas/types";

interface ZoneOption {
  value: string;
  label: string;
};

interface SearchBarProps {
  filters: VillaFilters;
  zones: ZoneOption[];
  maxAvailablePrice: number;
  onChange: (filters: VillaFilters) => void;
  onSearch: () => void;
  searchLabel?: string;
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

function numberFromInput(value: string, minimum: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : minimum;
}

export function SearchBar({
  filters,
  zones,
  maxAvailablePrice,
  onChange,
  onSearch,
  searchLabel = "ค้นหาบ้านพัก",
}: SearchBarProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const locationMenuId = useId();
  const amenitiesMenuId = useId();
  const [openMenu, setOpenMenu] = useState<"location" | "amenities" | null>(null);
  const [locationQuery, setLocationQuery] = useState("");

  const maxPrice = Math.max(maxAvailablePrice, 1000);
  const locationOptions = useMemo(
    () => [{ value: "all", label: "ทุกทำเล" }, ...zones],
    [zones],
  );
  const filteredLocations = useMemo(() => {
    const query = locationQuery.trim().toLocaleLowerCase("th-TH");

    if (!query) {
      return locationOptions;
    }

    return locationOptions.filter((zone) =>
      zone.label.toLocaleLowerCase("th-TH").includes(query),
    );
  }, [locationOptions, locationQuery]);

  const selectedLocation =
    locationOptions.find((zone) => zone.value === filters.zone)?.label ??
    "เลือกทำเลที่ต้องการ";
  const amenityLabel =
    filters.amenities.length > 0
      ? `เลือกแล้ว ${filters.amenities.length} รายการ`
      : "สิ่งอำนวยความสะดวก";

  useEffect(() => {
    if (!openMenu) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenu]);

  function updateFilters(nextFilters: Partial<VillaFilters>) {
    onChange({ ...filters, ...nextFilters });
  }

  function toggleAmenity(key: AmenityKey) {
    const isSelected = filters.amenities.includes(key);
    updateFilters({
      amenities: isSelected
        ? filters.amenities.filter((amenity) => amenity !== key)
        : [...filters.amenities, key],
    });
  }

  return (
    <section
      ref={containerRef}
      className="rounded-[20px] bg-[var(--site-surface)] px-6 pb-10 pt-6 shadow-[0_12px_16px_rgba(15,47,53,0.14)]"
    >
      <div className="grid gap-3 lg:grid-cols-[227px_155px_155px_230px_178px_auto] lg:items-end">
        <div className="relative min-w-0">
          <label className="text-sm font-medium leading-5 text-[var(--site-text)]">ทำเลที่พัก</label>
          <button
            type="button"
            className="mt-1 flex min-h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2 text-left text-[var(--site-text)]"
            onClick={() => {
              setOpenMenu(openMenu === "location" ? null : "location");
            }}
            aria-expanded={openMenu === "location"}
            aria-haspopup="dialog"
            aria-controls={openMenu === "location" ? locationMenuId : undefined}
          >
            <span className="flex min-w-0 items-center gap-2">
              <MapPin className="h-5 w-5 shrink-0 text-[var(--site-primary)]" />
              <span className="truncate text-lg leading-7">{selectedLocation}</span>
            </span>
            <ChevronDown className="h-5 w-5 shrink-0 text-[var(--site-text)]" />
          </button>
          {openMenu === "location" ? (
            <div
              id={locationMenuId}
              role="dialog"
              aria-label="เลือกทำเลที่พัก"
              className="absolute left-0 right-0 top-[4.75rem] z-30 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-3 shadow-[0_18px_54px_rgba(6,63,53,0.16)]"
            >
              <div className="flex h-10 items-center gap-2 rounded-xl border border-[var(--site-border)] px-3">
                <Search className="h-4 w-4 text-[var(--site-muted)]" />
                <input
                  value={locationQuery}
                  onChange={(event) => {
                    setLocationQuery(event.target.value);
                  }}
                  placeholder="ค้นหาทำเล"
                  className="w-full min-w-0 border-0 bg-transparent text-sm text-[var(--site-text)] outline-none placeholder:text-[var(--site-muted)]"
                />
              </div>
              <div role="listbox" aria-label="ทำเลที่พัก" className="mt-2 max-h-56 overflow-y-auto">
                {filteredLocations.map((zone) => (
                  <button
                    type="button"
                    key={zone.value}
                    role="option"
                    aria-selected={filters.zone === zone.value}
                    className="flex h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-medium text-[var(--site-text)] hover:bg-[var(--site-primary-soft)]"
                    onClick={() => {
                      updateFilters({ zone: zone.value });
                      setOpenMenu(null);
                    }}
                  >
                    <span className="truncate">{zone.label}</span>
                    {filters.zone === zone.value ? <Check className="h-4 w-4 text-[var(--site-accent)]" /> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-w-0">
          <label className="text-sm font-medium leading-5 text-[var(--site-text)]">ผู้เข้าพัก</label>
          <div className="mt-1 flex min-h-10 items-center gap-2 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2">
            <Users className="h-5 w-5 shrink-0 text-[var(--site-primary)]" />
            <input
              type="text"
              inputMode="numeric"
              min={1}
              value={filters.guests}
              onChange={(event) => {
                updateFilters({ guests: numberFromInput(event.target.value, 1) });
              }}
              className="w-full min-w-0 bg-transparent text-lg leading-7 text-[var(--site-text)] outline-none"
              aria-label="จำนวนผู้เข้าพัก"
            />
          </div>
        </div>

        <div className="min-w-0">
          <label className="text-sm font-medium leading-5 text-[var(--site-text)]">ห้องนอน</label>
          <div className="mt-1 flex min-h-10 items-center gap-2 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2">
            <BedDouble className="h-5 w-5 shrink-0 text-[var(--site-primary)]" />
            <input
              type="text"
              inputMode="numeric"
              min={1}
              value={filters.bedrooms}
              onChange={(event) => {
                updateFilters({ bedrooms: numberFromInput(event.target.value, 1) });
              }}
              className="w-full min-w-0 bg-transparent text-lg leading-7 text-[var(--site-text)] outline-none"
              aria-label="จำนวนห้องนอน"
            />
          </div>
        </div>

        <div className="relative min-w-0">
          <label className="text-sm font-medium leading-5 text-[var(--site-text)]">สิ่งอำนวยความสะดวก</label>
          <button
            type="button"
            className="mt-1 flex min-h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2 text-left"
            onClick={() => {
              setOpenMenu(openMenu === "amenities" ? null : "amenities");
            }}
            aria-expanded={openMenu === "amenities"}
            aria-haspopup="dialog"
            aria-controls={openMenu === "amenities" ? amenitiesMenuId : undefined}
          >
            <span className="flex min-w-0 items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 shrink-0 text-[var(--site-primary)]" />
              <span className="truncate text-lg leading-7 text-[var(--site-text)]">{amenityLabel}</span>
            </span>
            <ChevronDown className="h-5 w-5 shrink-0 text-[var(--site-text)]" />
          </button>
          {openMenu === "amenities" ? (
            <div
              id={amenitiesMenuId}
              role="dialog"
              aria-label="เลือกสิ่งอำนวยความสะดวก"
              className="absolute left-0 right-0 top-[4.75rem] z-30 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-3 shadow-[0_18px_54px_rgba(6,63,53,0.16)] lg:min-w-80"
            >
              <div role="group" aria-label="สิ่งอำนวยความสะดวก" className="grid max-h-72 gap-1 overflow-y-auto">
                {AMENITY_OPTIONS.map((amenity) => {
                  const isSelected = filters.amenities.includes(amenity.key);

                  return (
                    <button
                      type="button"
                      key={amenity.key}
                      role="checkbox"
                      aria-checked={isSelected}
                      className="flex h-11 items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-medium text-[var(--site-text)] hover:bg-[var(--site-primary-soft)]"
                      onClick={() => {
                        toggleAmenity(amenity.key);
                      }}
                    >
                      <span className="min-w-0 truncate">{amenity.label}</span>
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                          isSelected
                            ? "border-[var(--site-accent)] bg-[var(--site-accent)] text-[var(--site-on-accent)]"
                            : "border-[var(--site-border)] text-transparent"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <label className="text-sm font-normal leading-[21px] text-[var(--site-text)]">ราคาสูงสุด</label>
            <span className="text-sm leading-[21px] text-[var(--site-text)]">
              {currencyFormatter.format(filters.maxPrice)}
            </span>
          </div>
          <div className="flex h-[42px] items-center py-2">
            <input
              type="range"
              min={1000}
              max={maxPrice}
              step={500}
              value={Math.min(Math.max(filters.maxPrice, 1000), maxPrice)}
              onChange={(event) => {
                updateFilters({ maxPrice: numberFromInput(event.target.value, 1000) });
              }}
              className="h-2 w-full accent-[var(--site-primary)]"
              aria-label="ราคาสูงสุด"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onSearch}
          className="flex h-11 items-center justify-center gap-2 self-end rounded-full bg-[var(--site-primary)] px-4 text-base font-medium leading-6 text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--site-accent)] focus:ring-offset-2"
        >
          <Search className="h-5 w-5" />
          <span className="whitespace-nowrap">{searchLabel}</span>
        </button>
      </div>
    </section>
  );
}
