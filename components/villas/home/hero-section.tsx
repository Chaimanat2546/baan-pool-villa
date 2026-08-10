import type { ReactNode } from "react";

import { buildSiteAssetImageProxyPath, normalizePublicImageSourceUrl } from "@/lib/public-image-proxy";
import type { SiteImageSettings } from "@/lib/site-settings/types";

import { HeroCarousel, type HeroCarouselSlide } from "./hero-carousel";
import { HeroSearch } from "./hero-search";

interface ZoneOption {
  label: string;
  value: string;
}

interface HeroSectionProps {
  heroImage: SiteImageSettings;
  heroSlides?: SiteImageSettings[];
  maxAvailablePrice: number;
  search?: ReactNode;
  zones: ZoneOption[];
}

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
  heroImage,
  heroSlides = [],
  maxAvailablePrice,
  search,
  zones,
}: HeroSectionProps) {
  const heroSlidesWithLegacyFallback =
    heroSlides.length > 0 ? heroSlides : [heroImage];
  const slides: HeroCarouselSlide[] = heroSlidesWithLegacyFallback.flatMap(
    (slide, index) => {
      const sourceUrl = normalizePublicImageSourceUrl(slide.url);
      const src = sourceUrl
        ? buildSiteAssetImageProxyPath("hero", index)
        : isSafeLocalImagePath(slide.url)
          ? slide.url
          : null;

      return src ? [{ alt: slide.alt, src }] : [];
    },
  );

  return (
    <section className="relative lg:pb-20">
      <HeroCarousel slides={slides} />
      {search ?? (
        <HeroSearch maxAvailablePrice={maxAvailablePrice} zones={zones} />
      )}
    </section>
  );
}
