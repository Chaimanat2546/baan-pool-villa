import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-[373px] rounded-[22px] border border-[var(--site-border)] bg-[var(--site-surface)]"
          />
        ))}
      </div>
    </section>
  );
}
