import Image from "next/image";

import type { SiteImageSettings } from "@/lib/site-settings/types";
import type { VillaFilters } from "@/lib/villas/types";

import { SearchBar } from "../search/search-bar";

interface ZoneOption {
  label: string;
  value: string;
};

interface HeroSectionProps {
  filters: VillaFilters;
  heroImage: SiteImageSettings;
  maxAvailablePrice: number;
  onChange: (filters: VillaFilters) => void;
  onSearch: () => void;
  zones: ZoneOption[];
};

export function HeroSection({
  filters,
  heroImage,
  maxAvailablePrice,
  onChange,
  onSearch,
  zones,
}: HeroSectionProps) {
  return (
    <section className="relative lg:pb-20">
      <Image
        src={heroImage.url}
        alt={heroImage.alt}
        width={1565}
        height={1043}
        preload
        sizes="100vw"
        className="h-auto w-full"
      />
      <div className="absolute inset-x-0 bottom-0 z-10 hidden px-4 sm:px-6 lg:block lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SearchBar
            filters={filters}
            zones={zones}
            maxAvailablePrice={maxAvailablePrice}
            onChange={onChange}
            onSearch={onSearch}
          />
        </div>
      </div>
    </section>
  );
}
