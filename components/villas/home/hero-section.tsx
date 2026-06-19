import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";

import { buildSiteAssetProxyUrl } from "@/lib/public-image-proxy";
import type { SiteImageSettings } from "@/lib/site-settings/types";

import { HeroSearch } from "./hero-search";

interface ZoneOption {
  label: string;
  value: string;
}

interface HeroSectionProps {
  heroImage: SiteImageSettings;
  maxAvailablePrice: number;
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
  maxAvailablePrice,
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
      <HeroSearch maxAvailablePrice={maxAvailablePrice} zones={zones} />
    </section>
  );
}
