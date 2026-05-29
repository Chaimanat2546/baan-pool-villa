import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-[var(--site-surface-soft)] px-4 py-5 text-[var(--site-text)] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <Skeleton className="h-10 w-36 rounded-full" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-4">
            <Skeleton className="aspect-[16/10] rounded-[28px]" />
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="aspect-[4/3] rounded-2xl bg-[var(--site-surface-tint)]"
                />
              ))}
            </div>
          </div>
          <Skeleton className="h-72 rounded-[24px] bg-[var(--site-surface)] shadow-sm" />
        </div>
        <p className="text-sm font-semibold text-[var(--site-muted)]">
          กำลังเตรียมหน้ารายละเอียดบ้านพัก...
        </p>
      </div>
    </main>
  );
}
