import { Skeleton } from "@/components/ui/skeleton";
import { VillaCardSkeleton } from "../listing/villa-card-skeleton";

interface VillaRailSkeletonProps {
  cardCount?: number;
  withCta?: boolean;
}

export function VillaRailSkeleton({
  cardCount = 4,
  withCta = true,
}: VillaRailSkeletonProps) {
  return (
    <section
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-14"
      data-villa-rail-skeleton="true"
    >
      <div className="mx-auto max-w-2xl text-center">
        <Skeleton className="mx-auto h-8 w-64 bg-[var(--site-surface-tint)]" />
        <Skeleton className="mx-auto mt-3 h-5 w-full max-w-xl bg-[var(--site-surface-tint)]" />
      </div>
      <div className="-mx-4 mt-4 flex snap-x gap-5 overflow-x-auto px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:gap-6 lg:px-8 lg:py-8">
        {Array.from({ length: cardCount }).map((_, index) => (
          <div key={index} className="w-[290px] shrink-0 snap-start">
            <VillaCardSkeleton />
          </div>
        ))}
      </div>
      {withCta ? (
        <div className="mt-8 text-center">
          <Skeleton className="mx-auto h-12 w-44 rounded-xl bg-[var(--site-primary-soft)]" />
        </div>
      ) : null}
    </section>
  );
}
