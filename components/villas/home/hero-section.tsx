import Image from "next/image";

import type { VillaFilters } from "@/lib/villas/types";

import { SearchBar } from "../search/search-bar";

type ZoneOption = {
  label: string;
  value: string;
};

type HeroSectionProps = {
  filters: VillaFilters;
  maxAvailablePrice: number;
  onChange: (filters: VillaFilters) => void;
  onSearch: () => void;
  zones: ZoneOption[];
};

export function HeroSection({
  filters,
  maxAvailablePrice,
  onChange,
  onSearch,
  zones,
}: HeroSectionProps) {
  return (
    <section className="relative bg-white lg:pb-20">
      <Image
        src="/images/BPV-66_Cover-Web.jpg"
        alt="Pool Villa บ้านพูลวิลล่า พัทยา"
        width={1565}
        height={1043}
        priority
        sizes="100vw"
        className="h-auto w-full object-top lg:hidden"
      />
      <Image
        src="/images/BPV-66_Cover-Web.jpg"
        alt="Pool Villa บ้านพูลวิลล่า พัทยา"
        width={1565}
        height={1043}
        priority
        sizes="100vw"
        className="hidden h-[83.333svh] w-full object-cover object-top lg:block"
      />
      <div className="absolute inset-x-0 bottom-0 z-10 hidden translate-y-1/2 px-4 sm:px-6 lg:block lg:px-8">
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
