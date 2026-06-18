import { Skeleton } from "@/components/ui/skeleton";
import { VillaCardSkeleton } from "../listing/villa-card-skeleton";

function BookingSidebarSkeleton() {
  return (
    <aside className="lg:self-start" data-booking-sidebar-skeleton="true">
      <div className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-[var(--site-card-shadow)]">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-9 rounded-xl bg-[var(--site-surface-tint)]" />
          <Skeleton className="h-5 w-32 bg-[var(--site-surface-tint)]" />
          <Skeleton className="h-9 w-9 rounded-xl bg-[var(--site-surface-tint)]" />
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, index) => (
            <Skeleton key={index} className="h-8 rounded-md bg-[var(--site-primary-soft)]" />
          ))}
        </div>
        <Skeleton className="mt-4 h-20 rounded-xl bg-[var(--site-primary-soft)]" />
        <Skeleton className="mt-4 h-16 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-tint)]" />
        <div className="mt-4 grid gap-3">
          <Skeleton className="h-12 rounded-xl bg-[var(--site-surface-tint)]" />
          <Skeleton className="h-12 rounded-xl bg-[var(--site-primary-soft)]" />
          <Skeleton className="h-12 rounded-xl bg-[var(--site-primary-soft)]" />
        </div>
      </div>
    </aside>
  );
}

function DetailCardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <section className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-[0_10px_30px_rgba(6,63,53,0.06)]" data-detail-card-skeleton="true">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full bg-[var(--site-primary-soft)]" />
        <Skeleton className="h-7 w-44 bg-[var(--site-surface-tint)]" />
      </div>
      <div className="mt-4 space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} className="h-5 w-full bg-[var(--site-surface-tint)]" />
        ))}
      </div>
    </section>
  );
}

function RecommendedVillasRailSkeleton({ cardCount = 4 }: { cardCount?: number }) {
  return (
    <section
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-14"
      data-detail-recommended-rail-skeleton="true"
    >
      <div className="mx-auto max-w-2xl text-center">
        <Skeleton className="mx-auto h-8 w-64 bg-[var(--site-surface-tint)]" />
        <Skeleton className="mx-auto mt-3 h-5 w-full max-w-xl bg-[var(--site-surface-tint)]" />
      </div>
      <div className="-mx-4 mt-4 flex snap-x gap-5 overflow-x-auto px-4 py-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-8 lg:gap-6 lg:px-8 lg:py-8 [&::-webkit-scrollbar]:hidden">
        {Array.from({ length: cardCount }).map((_, index) => (
          <div key={index} className="w-[290px] shrink-0 snap-start">
            <VillaCardSkeleton />
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Skeleton className="mx-auto h-12 w-44 rounded-xl bg-[var(--site-primary-soft)]" />
      </div>
    </section>
  );
}

export function DetailLayoutSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-[402px] gap-6 px-[22.5px] pb-10 sm:max-w-7xl sm:px-6 lg:px-8" data-detail-layout-skeleton="true">
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <div className="grid min-w-0 content-start gap-6 lg:grid-cols-2">
          <DetailCardSkeleton />
          <DetailCardSkeleton lines={5} />
          <DetailCardSkeleton lines={3} />
          <DetailCardSkeleton lines={4} />
        </div>
        <BookingSidebarSkeleton />
      </div>
      <RecommendedVillasRailSkeleton cardCount={4} />
    </div>
  );
}
