import { Skeleton } from "@/components/ui/skeleton";

interface VillaCardSkeletonProps {
  className?: string;
}

export function VillaCardSkeleton({ className = "" }: VillaCardSkeletonProps) {
  return (
    <div
      className={`overflow-hidden rounded-[24px] border border-[var(--site-border)] bg-[var(--site-surface)] p-px shadow-[0_10px_15px_-3px_rgba(0,0,0,0.05),0_4px_6px_-2px_rgba(0,0,0,0.05)] ${className}`}
      data-villa-card-skeleton="true"
    >
      <Skeleton className="h-[216px] rounded-[23px] rounded-b-none bg-[var(--site-surface-tint)]" />
      <div className="p-3">
        <div className="flex items-start justify-between gap-3 pb-2">
          <Skeleton className="h-7 w-32 bg-[var(--site-surface-tint)]" />
          <Skeleton className="h-5 w-20 bg-[var(--site-surface-tint)]" />
        </div>
        <div className="flex gap-2 pb-3">
          <Skeleton className="h-4 w-24 bg-[var(--site-surface-tint)]" />
          <Skeleton className="h-4 w-24 bg-[var(--site-surface-tint)]" />
        </div>
        <div className="flex min-h-[34px] gap-1 pb-3">
          <Skeleton className="h-6 w-20 rounded-full bg-[var(--site-accent-soft)]" />
          <Skeleton className="h-6 w-24 rounded-full bg-[var(--site-accent-soft)]" />
        </div>
        <div className="flex items-end justify-between gap-3">
          <Skeleton className="h-7 w-36 bg-[var(--site-surface-tint)]" />
          <Skeleton className="h-5 w-20 bg-[var(--site-surface-tint)]" />
        </div>
      </div>
    </div>
  );
}
