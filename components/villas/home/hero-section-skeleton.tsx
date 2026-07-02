import { Skeleton } from "@/components/ui/skeleton";

export function HeroSearchSkeleton() {
  return (
    <>
      <div
        className="relative z-10 -mt-8 px-4 sm:px-6 lg:hidden"
        data-home-mobile-search-skeleton="true"
      >
        <div className="mx-auto max-w-7xl rounded-[20px] border border-[var(--site-border)] bg-[var(--site-surface)] px-6 pb-10 pt-6 shadow-[0_10px_28px_rgba(6,63,53,0.05)]">
          <div className="grid gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-14 rounded-xl bg-[var(--site-surface-tint)]"
              />
            ))}
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10 hidden px-4 sm:px-6 lg:block lg:px-8">
        <div className="mx-auto max-w-7xl rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-[0_10px_28px_rgba(6,63,53,0.05)]">
          <div className="grid gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-14 rounded-xl bg-[var(--site-surface-tint)]"
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function HeroSectionSkeleton() {
  return (
    <section className="relative lg:pb-20" data-hero-section-skeleton="true">
      <Skeleton className="aspect-[1565/1043] w-full rounded-none bg-[var(--site-surface-tint)]" />
      <HeroSearchSkeleton />
    </section>
  );
}
