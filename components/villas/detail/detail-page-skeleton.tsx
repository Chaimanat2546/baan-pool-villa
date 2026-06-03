import { Skeleton } from "@/components/ui/skeleton";
import { DetailLayoutSkeleton } from "./detail-layout-skeleton";
import { GallerySkeleton } from "./gallery-skeleton";
import { VillaIntroSkeleton } from "./villa-intro-skeleton";

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
