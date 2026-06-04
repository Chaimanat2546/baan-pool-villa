import { HeroSectionSkeleton } from "./hero-section-skeleton";
import { VillaRailSkeleton } from "./villa-rail-skeleton";

export function LoadingSkeleton() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--site-surface-soft)] text-[var(--site-text)]">
      <HeroSectionSkeleton />
      <div className="pt-0 lg:pt-20">
        <VillaRailSkeleton />
        <VillaRailSkeleton cardCount={4} withCta={false} />
      </div>
    </main>
  );
}
