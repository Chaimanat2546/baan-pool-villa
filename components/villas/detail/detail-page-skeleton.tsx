import { Skeleton } from "@/components/ui/skeleton";
import { DetailLayoutSkeleton } from "./detail-layout-skeleton";
import { GallerySkeleton } from "./gallery-skeleton";

function VillaIntroSkeleton() {
  return (
    <section className="border-b border-[var(--site-border)] pb-6" data-villa-intro-skeleton="true">
      <Skeleton className="h-6 w-20 rounded-full bg-[var(--site-primary-soft)]" />
      <Skeleton className="mt-3 h-10 w-full max-w-md bg-[var(--site-surface-tint)]" />
      <Skeleton className="mt-2 h-5 w-40 bg-[var(--site-surface-tint)]" />
      <div className="mt-3 flex flex-wrap gap-3">
        <Skeleton className="h-5 w-48 bg-[var(--site-surface-tint)]" />
        <Skeleton className="h-5 w-28 bg-[var(--site-surface-tint)]" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 rounded-2xl bg-[var(--site-surface-soft)]" />
        ))}
      </div>
    </section>
  );
}

export function VillaDetailPageSkeleton() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--site-surface-soft)] pb-24 text-[var(--site-text)] lg:pb-0" data-villa-detail-page-skeleton="true">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <Skeleton className="h-10 w-36 rounded-full bg-[var(--site-surface-tint)]" />
      </div>
      <GallerySkeleton />
      <div className="mx-auto w-full max-w-[402px] px-[22.5px] py-8 sm:max-w-7xl sm:px-6 lg:px-8">
        <VillaIntroSkeleton />
      </div>
      <DetailLayoutSkeleton />
    </main>
  );
}
