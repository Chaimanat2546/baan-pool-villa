import {
  AdminFieldRowsSkeleton,
  AdminHeaderSkeleton,
  AdminListSkeleton,
  AdminPanelSkeleton,
  AdminPreviewSkeleton,
} from "./admin-loading-primitives";

export function AdminSectionsSkeleton() {
  return (
    <div
      className="flex w-full flex-col gap-6 text-[var(--site-text)]"
      data-admin-sections-skeleton="true"
    >
      <AdminHeaderSkeleton actionCount={3} chipCount={2} />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)_360px]">
        <div className="min-w-0 xl:sticky xl:top-36 xl:self-start">
          <AdminPanelSkeleton titleWidth="w-32">
            <AdminListSkeleton items={6} />
          </AdminPanelSkeleton>
        </div>

        <main className="min-w-0">
          <AdminPanelSkeleton className="overflow-hidden p-0" titleWidth="w-0">
            <div className="border-b border-[var(--site-border)] px-4 py-4 sm:px-5">
              <SkeletonBlock />
            </div>
            <div className="grid gap-4 px-4 py-4 sm:px-5">
              <div className="grid gap-3 md:grid-cols-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <div
                    className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-4 py-3"
                    key={`stat-${index}`}
                  >
                    <div className="h-3 w-16 rounded-full bg-[var(--site-surface-tint)]" />
                    <div className="mt-3 h-6 w-28 rounded-md bg-[var(--site-surface-tint)]" />
                    <div className="mt-2 h-4 w-full rounded-md bg-[var(--site-surface-tint)]" />
                  </div>
                ))}
              </div>

              <AdminPanelSkeleton titleWidth="w-48">
                <AdminFieldRowsSkeleton rows={3} />
              </AdminPanelSkeleton>
              <AdminPanelSkeleton titleWidth="w-44">
                <AdminFieldRowsSkeleton rows={5} />
              </AdminPanelSkeleton>
              <AdminPanelSkeleton titleWidth="w-36">
                <AdminFieldRowsSkeleton rows={4} />
              </AdminPanelSkeleton>
            </div>
          </AdminPanelSkeleton>
        </main>

        <aside className="grid content-start gap-4 2xl:sticky 2xl:top-24 2xl:self-start">
          <AdminPanelSkeleton titleWidth="w-24">
            <AdminPreviewSkeleton rows={5} />
          </AdminPanelSkeleton>
          <AdminPanelSkeleton titleWidth="w-32">
            <div className="space-y-3">
              <div className="h-40 rounded-xl bg-[var(--site-surface-tint)]" />
              <div className="grid gap-2">
                <div className="h-4 w-full rounded-md bg-[var(--site-surface-tint)]" />
                <div className="h-4 w-4/5 rounded-md bg-[var(--site-surface-tint)]" />
                <div className="h-4 w-2/3 rounded-md bg-[var(--site-surface-tint)]" />
              </div>
            </div>
          </AdminPanelSkeleton>
        </aside>
      </div>
    </div>
  );
}

function SkeletonBlock() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
      <div className="min-w-0">
        <div className="h-5 w-44 rounded-md bg-[var(--site-surface-tint)]" />
        <div className="mt-2 h-4 w-full max-w-[24rem] rounded-md bg-[var(--site-surface-tint)]" />
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="h-8 w-36 rounded-full bg-[var(--site-surface-tint)]" />
          <div className="h-8 w-24 rounded-full bg-[var(--site-surface-tint)]" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="h-10 w-28 rounded-md bg-[var(--site-surface-tint)]" />
        <div className="h-10 w-28 rounded-md bg-[var(--site-surface-tint)]" />
        <div className="h-10 w-10 rounded-md bg-[var(--site-surface-tint)]" />
        <div className="h-10 w-10 rounded-md bg-[var(--site-surface-tint)]" />
      </div>
    </div>
  );
}
