import { VillaCardSkeleton } from "./villa-card-skeleton";

interface VillaGridSkeletonProps {
  count?: number;
}

export function VillaGridSkeleton({ count = 6 }: VillaGridSkeletonProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-villa-grid-skeleton="true">
      {Array.from({ length: count }).map((_, index) => (
        <VillaCardSkeleton key={index} />
      ))}
    </div>
  );
}
