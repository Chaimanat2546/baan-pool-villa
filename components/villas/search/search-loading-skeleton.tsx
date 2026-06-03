import { Skeleton } from "@/components/ui/skeleton";
import { VillaGridSkeleton } from "../listing/villa-grid-skeleton";

export function SearchLoadingSkeleton() {
  return (
    <main className="min-h-screen bg-[var(--site-surface-soft)] px-4 py-5 text-[var(--site-text)] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4 py-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Skeleton className="h-4 w-36 bg-[var(--site-accent-soft)]" />
            <Skeleton className="mt-3 h-10 w-full max-w-xl bg-[var(--site-surface-tint)]" />
          </div>
          <Skeleton className="h-16 w-full max-w-sm bg-[var(--site-surface-tint)]" />
        </header>
        <div className="grid gap-3 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-[0_10px_28px_rgba(6,63,53,0.05)] md:grid-cols-[minmax(0,1fr)_260px]">
          <Skeleton className="h-16 rounded-xl bg-[var(--site-surface-tint)]" />
          <Skeleton className="h-16 rounded-xl bg-[var(--site-surface-tint)]" />
        </div>
        <Skeleton className="hidden h-24 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] lg:block" />
        <section className="scroll-mt-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Skeleton className="h-4 w-36 bg-[var(--site-surface-tint)]" />
              <Skeleton className="mt-2 h-8 w-32 bg-[var(--site-surface-tint)]" />
            </div>
          </div>
          <Skeleton className="mb-5 h-24 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)]" />
          <VillaGridSkeleton count={6} />
        </section>
      </div>
    </main>
  );
}
