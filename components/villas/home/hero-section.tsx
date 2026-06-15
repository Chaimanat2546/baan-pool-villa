import Image from "next/image";

import { buildSiteAssetProxyUrl } from "@/lib/public-image-proxy";
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

function isSafeLocalImagePath(value: string | null): value is string {
  const trimmedValue = value?.trim();

  return Boolean(
    trimmedValue &&
      trimmedValue.startsWith("/") &&
      !trimmedValue.startsWith("//") &&
      !trimmedValue.startsWith("/\\"),
  );
}

export function HeroSection({
  filters,
  heroImage,
  maxAvailablePrice,
  onChange,
  onSearch,
  zones,
}: HeroSectionProps) {
  const heroImageSrc =
    buildSiteAssetProxyUrl(heroImage.url, { quality: 75, width: 1920 }) ??
    (isSafeLocalImagePath(heroImage.url) ? heroImage.url : null);

  return (
    <section className="relative lg:pb-20">
      {heroImageSrc ? (
        <Image
          src={heroImageSrc}
          alt={heroImage.alt}
          width={1565}
          height={1043}
          preload
          sizes="100vw"
          unoptimized
          className="h-auto w-full"
        />
      ) : (
        <div
          aria-hidden="true"
          className="aspect-[1565/1043] w-full bg-[var(--site-surface-tint)]"
        />
      )}
      <div
        className="relative z-10 -mt-8 px-4 sm:px-6 lg:hidden"
        data-home-mobile-search="true"
      >
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
