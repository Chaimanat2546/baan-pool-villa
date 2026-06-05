import {
  AdminFieldRowsSkeleton,
  AdminHeaderSkeleton,
  AdminPanelSkeleton,
} from "./admin-loading-primitives";

export function AdminTikTokSkeleton() {
  return (
    <div
      className="flex w-full flex-col gap-6 text-[var(--site-text)]"
      data-admin-tiktok-skeleton="true"
    >
      <AdminHeaderSkeleton actionCount={2} chipCount={1} />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <div className="grid min-w-0 gap-6">
          <AdminPanelSkeleton titleWidth="w-36">
            <AdminFieldRowsSkeleton rows={2} />
          </AdminPanelSkeleton>

          <AdminPanelSkeleton titleWidth="w-32">
            <div className="space-y-3">
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  className="grid gap-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-3 shadow-sm md:grid-cols-[24px_48px_112px_minmax(0,1fr)] md:items-center 2xl:grid-cols-[24px_48px_112px_minmax(0,1fr)_auto_auto]"
                  key={`video-${index}`}
                >
                  <div className="h-5 w-5 rounded bg-[var(--site-surface-tint)]" />
                  <div className="size-12 rounded-full bg-[var(--site-surface-tint)]" />
                  <div className="h-20 rounded-md bg-[var(--site-surface-tint)]" />
                  <div className="h-10 rounded-md bg-[var(--site-surface-tint)]" />
                  <div className="flex gap-2 md:col-start-4 2xl:col-start-auto">
                    <div className="h-10 w-20 rounded-md bg-[var(--site-surface-tint)]" />
                    <div className="h-10 w-20 rounded-md bg-[var(--site-surface-tint)]" />
                  </div>
                </div>
              ))}
            </div>
          </AdminPanelSkeleton>
        </div>

        <aside className="grid min-w-0 content-start gap-4 xl:sticky xl:top-36">
          <AdminPanelSkeleton titleWidth="w-24">
            <div className="rounded-lg bg-[var(--site-surface-soft)] px-3 py-4 text-center">
              <div className="mx-auto h-56 w-[min(220px,100%)] rounded-xl bg-[var(--site-surface-tint)]" />
              <div className="mt-4 space-y-2">
                <div className="mx-auto h-4 w-40 rounded-md bg-[var(--site-surface-tint)]" />
                <div className="mx-auto h-4 w-28 rounded-md bg-[var(--site-surface-tint)]" />
              </div>
            </div>
          </AdminPanelSkeleton>
        </aside>
      </div>
    </div>
  );
}
