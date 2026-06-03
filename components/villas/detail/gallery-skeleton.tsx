import { Skeleton } from "@/components/ui/skeleton";

export function GallerySkeleton() {
  return (
    <section className="mx-auto w-full max-w-7xl px-0 sm:px-6 lg:px-8" data-gallery-skeleton="true">
      <div className="grid w-full gap-2 bg-transparent lg:h-[500px] lg:grid-cols-[3fr_2fr] lg:gap-1 lg:overflow-hidden lg:rounded-xl">
        <Skeleton className="aspect-[16/11] rounded-none bg-[var(--site-surface-tint)] sm:rounded-2xl lg:aspect-auto lg:h-full lg:rounded-l-xl lg:rounded-r-none" />
        <div className="mx-auto grid w-[calc(100%_-_45px)] grid-cols-3 gap-2 sm:w-full lg:h-full lg:grid-cols-2 lg:grid-rows-2 lg:gap-1">
          <Skeleton className="aspect-[4/3] rounded-2xl bg-[var(--site-surface-tint)] lg:aspect-auto lg:h-full lg:rounded-none" />
          <Skeleton className="aspect-[4/3] rounded-2xl bg-[var(--site-surface-tint)] lg:aspect-auto lg:h-full lg:rounded-l-none lg:rounded-r-xl lg:rounded-bl-none" />
          <Skeleton className="aspect-[4/3] rounded-2xl bg-[var(--site-surface-tint)] lg:col-span-2 lg:aspect-auto lg:h-full lg:rounded-br-xl lg:rounded-t-none" />
        </div>
      </div>
    </section>
  );
}
