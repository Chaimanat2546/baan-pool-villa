import type { ComponentProps } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function AdminHeaderSkeleton({
  actionCount = 3,
  chipCount = 1,
  showStats = false,
  statsCount = 4,
}: {
  actionCount?: number;
  chipCount?: number;
  showStats?: boolean;
  statsCount?: number;
}) {
  return (
    <div className="sticky top-0 z-30 -mx-4 -mt-4 border-b border-[var(--site-border)] bg-[var(--site-background)]/90 px-4 pb-4 pt-4 backdrop-blur-xl lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <Skeleton className="h-3.5 w-28 rounded-full" />
          <Skeleton className="mt-3 h-10 w-full max-w-[22rem]" />
          <Skeleton className="mt-3 h-4 w-full max-w-[34rem]" />
          <Skeleton className="mt-2 h-4 w-full max-w-[24rem]" />
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from({ length: chipCount }, (_, index) => (
              <Skeleton
                className="h-8 w-40 rounded-full"
                key={`chip-${index}`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {Array.from({ length: actionCount }, (_, index) => (
            <Skeleton
              className={cn(
                "h-12 rounded-md",
                index === actionCount - 1 ? "w-44" : "w-32",
              )}
              key={`action-${index}`}
            />
          ))}
        </div>
      </div>

      {showStats ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: statsCount }, (_, index) => (
            <div
              className="rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-3 shadow-sm"
              key={`stat-${index}`}
            >
              <Skeleton className="h-3 w-20 rounded-full" />
              <Skeleton className="mt-3 h-6 w-24" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AdminPanelSkeleton({
  children,
  className,
  lines = 4,
  titleWidth = "w-40",
}: {
  children?: React.ReactNode;
  className?: string;
  lines?: number;
  titleWidth?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="min-w-0 flex-1">
          <Skeleton className={cn("h-5", titleWidth)} />
          <Skeleton className="mt-2 h-4 w-full max-w-[20rem]" />
          <Skeleton className="mt-2 h-4 w-full max-w-[14rem]" />
        </div>
      </div>

      {children ? (
        <div className="mt-4">{children}</div>
      ) : (
        <div className="mt-4 grid gap-3">
          {Array.from({ length: lines }, (_, index) => (
            <Skeleton className="h-10 w-full rounded-md" key={`line-${index}`} />
          ))}
        </div>
      )}
    </section>
  );
}

export function AdminListSkeleton({
  className,
  items = 5,
}: {
  className?: string;
  items?: number;
}) {
  return (
    <div className={cn("grid gap-3", className)}>
      {Array.from({ length: items }, (_, index) => (
        <div
          className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-3 shadow-sm"
          key={`item-${index}`}
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-18 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-5 w-full max-w-[12rem]" />
          <Skeleton className="mt-2 h-4 w-full max-w-[10rem]" />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminFieldRowsSkeleton({
  className,
  rows = 4,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div className={cn("grid gap-3", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div className="grid gap-2" key={`row-${index}`}>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function AdminCardGridSkeleton({
  cards = 3,
  className,
}: {
  cards?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-3", className)}>
      {Array.from({ length: cards }, (_, index) => (
        <div
          className="rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4"
          key={`card-${index}`}
        >
          <Skeleton className="h-3 w-16 rounded-full" />
          <Skeleton className="mt-3 h-12 w-full rounded-md" />
          <Skeleton className="mt-3 h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function AdminPreviewSkeleton({
  className,
  rows = 5,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4",
        className,
      )}
    >
      <Skeleton className="h-32 w-full rounded-lg" />
      <div className="mt-4 grid gap-3">
        {Array.from({ length: rows }, (_, index) => (
          <div
            className="flex items-start justify-between gap-3 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2"
            key={`preview-${index}`}
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminEditorCanvasSkeleton(
  props: Omit<ComponentProps<"div">, "children">,
) {
  const { className, ...rest } = props;

  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm",
        className,
      )}
      {...rest}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--site-border)] px-4 py-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-2 h-4 w-full max-w-[24rem]" />
        </div>
        <div className="rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2">
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
      </div>

      <div className="px-3 py-4 sm:px-5 sm:py-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <div className="grid gap-4 lg:grid-cols-[3fr_1.4fr]">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
