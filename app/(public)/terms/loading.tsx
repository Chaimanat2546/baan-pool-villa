import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-[var(--site-bg)] text-[var(--site-text)]">
      <article className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <header className="space-y-2">
          <Skeleton className="h-10 w-40 bg-[var(--site-surface-tint)]" />
          <Skeleton className="h-4 w-28 bg-[var(--site-surface-tint)]" />
        </header>
        <section className="grid gap-4">
          <Skeleton className="h-6 w-3/4 bg-[var(--site-surface-tint)]" />
          <Skeleton className="h-4 w-full bg-[var(--site-surface-tint)]" />
          <Skeleton className="h-4 w-full bg-[var(--site-surface-tint)]" />
          <Skeleton className="h-4 w-5/6 bg-[var(--site-surface-tint)]" />
          <Skeleton className="mt-2 h-8 w-2/3 bg-[var(--site-surface-tint)]" />
          <Skeleton className="h-4 w-full bg-[var(--site-surface-tint)]" />
          <Skeleton className="h-4 w-11/12 bg-[var(--site-surface-tint)]" />
        </section>
      </article>
    </main>
  );
}
