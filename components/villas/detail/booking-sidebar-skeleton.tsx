import { Skeleton } from "@/components/ui/skeleton";

export function BookingSidebarSkeleton() {
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
