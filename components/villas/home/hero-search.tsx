"use client";

import { useState } from "react";

import { SearchBar } from "@/components/villas/search/search-bar";
import {
  filtersToSearchParams,
  getDefaultFilters,
  normalizeFiltersForSearch,
} from "@/lib/villas/filters";

interface ZoneOption {
  label: string;
  value: string;
}

interface HeroSearchProps {
  maxAvailablePrice: number;
  zones: ZoneOption[];
}

export function HeroSearch({ maxAvailablePrice, zones }: HeroSearchProps) {
  const [filters, setFilters] = useState(() =>
    getDefaultFilters(Math.max(maxAvailablePrice, 1000)),
  );

  function handleSearch() {
    const shouldOmitPlaceholderPrice =
      maxAvailablePrice <= 1000 && filters.maxPrice <= 1000;
    const params = filtersToSearchParams(
      normalizeFiltersForSearch(filters, maxAvailablePrice),
      { omitMaxPrice: shouldOmitPlaceholderPrice },
    );
    const query = params.toString();

    window.open(query ? `/search?${query}` : "/search", "_self");
  }

  return (
    <>
      <div
        className="relative z-10 -mt-8 px-4 sm:px-6 lg:hidden"
        data-home-mobile-search="true"
      >
        <div className="mx-auto max-w-7xl">
          <SearchBar
            filters={filters}
            zones={zones}
            maxAvailablePrice={maxAvailablePrice}
            onChange={setFilters}
            onSearch={handleSearch}
          />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10 hidden px-4 sm:px-6 lg:block lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SearchBar
            filters={filters}
            zones={zones}
            maxAvailablePrice={maxAvailablePrice}
            onChange={setFilters}
            onSearch={handleSearch}
          />
        </div>
      </div>
    </>
  );
}
