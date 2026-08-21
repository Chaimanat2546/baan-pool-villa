import { ProgressiveImage } from "@/components/ui/progressive-image";

import type { HeroCarouselSlide } from "./hero-carousel";

export function HeroCarouselFallback({
  slides,
}: {
  slides: HeroCarouselSlide[];
}) {
  const firstSlide = slides[0];

  if (!firstSlide) {
    return <div aria-hidden="true" className="aspect-[1565/1043] w-full bg-[var(--site-surface-tint)]" />;
  }

  return (
    <div
      aria-label="ภาพแนะนำบ้านพัก"
      className="relative aspect-[1565/1043] w-full overflow-hidden bg-[var(--site-surface-tint)]"
      data-hero-carousel-static="true"
      role="img"
    >
      <ProgressiveImage
        alt={firstSlide.alt}
        className="object-fill"
        fill
        fullImageActive
        fullImageFetchPriority="high"
        fullImageLoading="eager"
        fullImageVisibleImmediately
        previewActive
        previewFetchPriority="high"
        previewLoading="eager"
        previewMaximumWidth={96}
        quality={75}
        sizes="100vw"
        src={firstSlide.src}
      />
    </div>
  );
}
