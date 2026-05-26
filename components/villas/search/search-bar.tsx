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

type ZoneOption = {
  value: string;
  label: string;
};

type SearchBarProps = {
  filters: VillaFilters;
  zones: ZoneOption[];
  maxAvailablePrice: number;
  onChange: (filters: VillaFilters) => void;
  onSearch: () => void;
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
}: SearchBarProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const locationMenuId = useId();
  const amenitiesMenuId = useId();
  const [openMenu, setOpenMenu] = useState<"location" | "amenities" | null>(null);
  const [locationQuery, setLocationQuery] = useState("");

  const maxPrice = Math.max(maxAvailablePrice, 1000);
  const locationOptions = useMemo(
    () => [
      { value: "all", label: "ทุกทำเล" },
      ...zones,
    ],
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
  const selectedAmenityCount = filters.amenities.length;
  const amenityLabel =
    selectedAmenityCount > 0
      ? `เลือกแล้ว ${selectedAmenityCount} รายการ`
      : "เลือกสิ่งอำนวยความสะดวก";

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
      className="rounded-[28px] border border-[#dbe7e3] bg-white p-3 shadow-[0_22px_70px_rgba(6,63,53,0.12)]"
    >
      <div className="grid gap-2 lg:grid-cols-[1.35fr_0.65fr_0.65fr_1.2fr_1fr_auto]">
        <div className="relative min-w-0">
          <label className="px-4 text-xs font-semibold text-[#55746b]">
            ทำเลที่พัก
          </label>
          <button
            type="button"
            className="mt-1 flex h-14 w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-transparent px-4 text-left text-[#063f35] transition hover:border-[#dbe7e3] hover:bg-[#f7faf8]"
            onClick={() =>
              setOpenMenu(openMenu === "location" ? null : "location")
            }
            aria-expanded={openMenu === "location"}
            aria-haspopup="dialog"
            aria-controls={openMenu === "location" ? locationMenuId : undefined}
          >
            <span className="flex min-w-0 items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-[#0f5a66]" />
              <span className="truncate text-sm font-semibold">
                {selectedLocation}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[#55746b]" />
          </button>
          {openMenu === "location" ? (
            <div
              id={locationMenuId}
              role="dialog"
              aria-label="เลือกทำเลที่พัก"
              className="absolute left-0 right-0 top-[5.25rem] z-30 rounded-3xl border border-[#dbe7e3] bg-white p-3 shadow-[0_18px_54px_rgba(6,63,53,0.16)]"
            >
              <div className="flex h-10 items-center gap-2 rounded-2xl border border-[#dbe7e3] px-3">
                <Search className="h-4 w-4 text-[#7b928a]" />
                <input
                  value={locationQuery}
                  onChange={(event) => setLocationQuery(event.target.value)}
                  placeholder="ค้นหาทำเล"
                  className="w-full min-w-0 border-0 bg-transparent text-sm text-[#063f35] outline-none placeholder:text-[#8aa099]"
                />
              </div>
              <div
                role="listbox"
                aria-label="ทำเลที่พัก"
                className="mt-2 max-h-56 overflow-y-auto"
              >
                {filteredLocations.map((zone) => (
                  <button
                    type="button"
                    key={zone.value}
                    role="option"
                    aria-selected={filters.zone === zone.value}
                    className="flex h-11 w-full items-center justify-between rounded-2xl px-3 text-left text-sm font-medium text-[#063f35] hover:bg-[#f4f8f5]"
                    onClick={() => {
                      updateFilters({ zone: zone.value });
                      setOpenMenu(null);
                    }}
                  >
                    <span className="truncate">{zone.label}</span>
                    {filters.zone === zone.value ? (
                      <Check className="h-4 w-4 shrink-0 text-[#f6ad21]" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-w-0">
          <label className="px-4 text-xs font-semibold text-[#55746b]">
            ผู้เข้าพัก
          </label>
          <div className="mt-1 flex h-14 items-center gap-2 rounded-2xl px-4 transition hover:bg-[#f7faf8]">
            <Users className="h-4 w-4 shrink-0 text-[#0f5a66]" />
            <input
              type="number"
              min={1}
              value={filters.guests}
              onChange={(event) =>
                updateFilters({ guests: numberFromInput(event.target.value, 1) })
              }
              className="w-full min-w-0 bg-transparent text-sm font-semibold text-[#063f35] outline-none"
              aria-label="จำนวนผู้เข้าพัก"
            />
          </div>
        </div>

        <div className="min-w-0">
          <label className="px-4 text-xs font-semibold text-[#55746b]">
            ห้องนอน
          </label>
          <div className="mt-1 flex h-14 items-center gap-2 rounded-2xl px-4 transition hover:bg-[#f7faf8]">
            <BedDouble className="h-4 w-4 shrink-0 text-[#0f5a66]" />
            <input
              type="number"
              min={1}
              value={filters.bedrooms}
              onChange={(event) =>
                updateFilters({
                  bedrooms: numberFromInput(event.target.value, 1),
                })
              }
              className="w-full min-w-0 bg-transparent text-sm font-semibold text-[#063f35] outline-none"
              aria-label="จำนวนห้องนอน"
            />
          </div>
        </div>

        <div className="relative min-w-0">
          <label className="px-4 text-xs font-semibold text-[#55746b]">
            สิ่งอำนวยความสะดวก
          </label>
          <button
            type="button"
            className="mt-1 flex h-14 w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-transparent px-4 text-left transition hover:border-[#dbe7e3] hover:bg-[#f7faf8]"
            onClick={() =>
              setOpenMenu(openMenu === "amenities" ? null : "amenities")
            }
            aria-expanded={openMenu === "amenities"}
            aria-haspopup="dialog"
            aria-controls={openMenu === "amenities" ? amenitiesMenuId : undefined}
          >
            <span className="flex min-w-0 items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#0f5a66]" />
              <span className="truncate text-sm font-semibold text-[#063f35]">
                {amenityLabel}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[#55746b]" />
          </button>
          {openMenu === "amenities" ? (
            <div
              id={amenitiesMenuId}
              role="dialog"
              aria-label="เลือกสิ่งอำนวยความสะดวก"
              className="absolute left-0 right-0 top-[5.25rem] z-30 rounded-3xl border border-[#dbe7e3] bg-white p-3 shadow-[0_18px_54px_rgba(6,63,53,0.16)] lg:min-w-80"
            >
              <div
                role="group"
                aria-label="สิ่งอำนวยความสะดวก"
                className="grid max-h-72 gap-1 overflow-y-auto"
              >
                {AMENITY_OPTIONS.map((amenity) => {
                  const isSelected = filters.amenities.includes(amenity.key);

                  return (
                    <button
                      type="button"
                      key={amenity.key}
                      role="checkbox"
                      aria-checked={isSelected}
                      className="flex h-11 items-center justify-between gap-3 rounded-2xl px-3 text-left text-sm font-medium text-[#063f35] hover:bg-[#f4f8f5]"
                      onClick={() => toggleAmenity(amenity.key)}
                    >
                      <span className="min-w-0 truncate">
                        {amenity.label}
                      </span>
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                          isSelected
                            ? "border-[#f6ad21] bg-[#f6ad21] text-white"
                            : "border-[#cadad5] text-transparent"
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
          <label className="px-4 text-xs font-semibold text-[#55746b]">
            ราคาสูงสุด
          </label>
          <div className="mt-1 flex h-14 flex-col justify-center rounded-2xl px-4 transition hover:bg-[#f7faf8]">
            <span className="truncate text-sm font-bold text-[#d88d00]">
              {currencyFormatter.format(filters.maxPrice)}
            </span>
            <input
              type="range"
              min={1000}
              max={maxPrice}
              step={500}
              value={Math.min(Math.max(filters.maxPrice, 1000), maxPrice)}
              onChange={(event) =>
                updateFilters({ maxPrice: numberFromInput(event.target.value, 1000) })
              }
              className="mt-1 h-2 w-full accent-[#f6ad21]"
              aria-label="ราคาสูงสุด"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onSearch}
          className="flex h-14 items-center justify-center gap-2 self-end rounded-2xl bg-[#064d3d] px-6 text-sm font-bold text-white shadow-[0_14px_30px_rgba(6,77,61,0.25)] transition hover:bg-[#04382d] focus:outline-none focus:ring-2 focus:ring-[#f6ad21] focus:ring-offset-2 lg:min-w-44"
        >
          <Search className="h-4 w-4" />
          <span className="whitespace-nowrap">ค้นหาบ้านพัก</span>
        </button>
      </div>
    </section>
  );
}
