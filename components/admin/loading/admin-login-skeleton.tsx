import { Skeleton } from "@/components/ui/skeleton";

export function AdminLoginSkeleton() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center px-4 py-8"
      data-admin-login-skeleton="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-6 shadow-sm">
        <Skeleton className="h-4 w-20 rounded-full" />
        <Skeleton className="mt-4 h-10 w-48" />
        <Skeleton className="mt-2 h-4 w-full max-w-[18rem]" />
        <div className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full rounded-md" />
          </div>
          <div className="grid gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-full rounded-md" />
          </div>
          <Skeleton className="mt-2 h-11 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
